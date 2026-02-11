// src/live-game.js — Live Client Data API poller for in-game stats
// Polls https://127.0.0.1:2999/liveclientdata for KDA, gold, CS, events, timers
const https = require('https');

// Disable TLS certificate validation for the local Riot API (self-signed cert)
const agent = new https.Agent({ rejectUnauthorized: false });

const BASE_URL = 'https://127.0.0.1:2999/liveclientdata';

let pollTimer = null;
let isGameActive = false;
let lastEventIndex = 0;
let goldHistory = []; // Track gold over time for the graph

/**
 * Fetch JSON from the Live Client Data API
 * @param {string} endpoint - API endpoint path
 * @returns {Promise<object|null>} parsed JSON or null on error
 */
function fetchLiveData(endpoint) {
  return new Promise((resolve) => {
    const url = `${BASE_URL}${endpoint}`;
    const req = https.get(url, { agent, timeout: 3000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

/**
 * Start polling live game data
 * @param {object} options
 * @param {number} options.pollIntervalMs - Polling interval
 * @param {function} options.onGameData - Callback with full game state
 * @param {function} options.onGameEvent - Callback for new events (kills, objectives)
 * @param {function} options.onGameStart - Callback when game is first detected
 * @param {function} options.onGameEnd - Callback when game ends
 */
function startLiveGamePoller({ pollIntervalMs = 500, onGameData, onGameEvent, onGameStart, onGameEnd }) {
  console.log('[LiveGame] Starting poller...');
  lastEventIndex = 0;
  goldHistory = [];

  pollTimer = setInterval(async () => {
    const allData = await fetchLiveData('/allgamedata');

    if (!allData) {
      // Game not active or API not available
      if (isGameActive) {
        isGameActive = false;
        if (onGameEnd) onGameEnd();
        console.log('[LiveGame] Game ended or API unavailable');
      }
      return;
    }

    // Game just started
    if (!isGameActive) {
      isGameActive = true;
      lastEventIndex = 0;
      goldHistory = [];
      if (onGameStart) onGameStart();
      console.log('[LiveGame] Game detected!');
    }

    // Format game data
    const gameState = formatGameData(allData);

    // Track gold history for the gold difference graph
    if (gameState.gameTime > 0 && gameState.gameTime % 10 < 1) {
      // Sample every ~10 seconds
      goldHistory.push({
        time: Math.floor(gameState.gameTime),
        blueGold: gameState.blueTeam.totalGold,
        redGold: gameState.redTeam.totalGold,
        diff: gameState.blueTeam.totalGold - gameState.redTeam.totalGold
      });
    }
    gameState.goldHistory = goldHistory;

    if (onGameData) onGameData(gameState);

    // Check for new events
    if (allData.events && allData.events.Events) {
      const newEvents = allData.events.Events.slice(lastEventIndex);
      for (const event of newEvents) {
        if (onGameEvent) onGameEvent(formatEvent(event));
      }
      lastEventIndex = allData.events.Events.length;
    }

  }, pollIntervalMs);
}

/**
 * Format raw Live Client Data into a clean game state
 * @param {object} data - Raw /allgamedata response
 * @returns {object} formatted game state
 */
function formatGameData(data) {
  const players = data.allPlayers || [];
  const gameStats = data.gameData || {};
  const activePlayer = data.activePlayer || {};

  // Split into blue (ORDER) and red (CHAOS) teams
  const bluePlayers = players.filter(p => p.team === 'ORDER');
  const redPlayers = players.filter(p => p.team === 'CHAOS');

  const formatPlayer = (p) => ({
    summonerName: p.riotIdGameName || p.summonerName || 'Unknown',
    tagLine: p.riotIdTagLine || '',
    championName: p.championName || '',
    rawChampionName: p.rawChampionName || '',
    level: p.level || 0,
    kills: p.scores ? p.scores.kills : 0,
    deaths: p.scores ? p.scores.deaths : 0,
    assists: p.scores ? p.scores.assists : 0,
    cs: p.scores ? p.scores.creepScore : 0,
    gold: 0, // Gold per player not directly exposed; we approximate
    items: (p.items || []).map(i => ({
      itemID: i.itemID,
      displayName: i.displayName,
      count: i.count,
      price: i.price
    })),
    summonerSpells: p.summonerSpells || {},
    runes: p.runes || {},
    team: p.team,
    position: p.position || '',
    isDead: p.isDead || false,
    respawnTimer: p.respawnTimer || 0,
    skinID: p.skinID || 0
  });

  const blueFormatted = bluePlayers.map(formatPlayer);
  const redFormatted = redPlayers.map(formatPlayer);

  // Calculate team totals
  const sumTeamStats = (teamPlayers) => ({
    totalKills: teamPlayers.reduce((s, p) => s + p.kills, 0),
    totalDeaths: teamPlayers.reduce((s, p) => s + p.deaths, 0),
    totalAssists: teamPlayers.reduce((s, p) => s + p.assists, 0),
    totalCS: teamPlayers.reduce((s, p) => s + p.cs, 0),
    totalGold: teamPlayers.reduce((s, p) => s + (p.items || []).reduce((g, i) => g + (i.price || 0) * (i.count || 1), 0), 0),
    players: teamPlayers
  });

  // Detect game mode
  const gameMode = gameStats.gameMode || 'CLASSIC';
  const mapName = gameStats.mapName || 'Map11';
  const gameTime = gameStats.gameTime || 0;

  // Detect objective timers from events
  const events = (data.events && data.events.Events) || [];
  const objectiveTimers = getObjectiveTimers(events, gameTime);

  return {
    gameTime,
    gameMode,
    mapName,
    mapNumber: gameStats.mapNumber || 11,
    blueTeam: sumTeamStats(blueFormatted),
    redTeam: sumTeamStats(redFormatted),
    activePlayer: activePlayer.riotIdGameName || activePlayer.summonerName || '',
    objectiveTimers,
    isGameActive: true
  };
}

/**
 * Calculate objective respawn timers based on game events
 * @param {Array} events - Game events
 * @param {number} currentTime - Current game time in seconds
 * @returns {object} timers
 */
function getObjectiveTimers(events, currentTime) {
  const timers = {
    baron: { alive: true, respawnAt: 0, lastKilledBy: '' },
    dragon: { alive: true, respawnAt: 0, lastKilledBy: '', dragonType: '' },
    herald: { alive: true, respawnAt: 0, lastKilledBy: '' },
    elderDragon: { alive: true, respawnAt: 0, lastKilledBy: '' }
  };

  // Baron respawn: 6 minutes (360s), spawns at 20:00
  // Dragon respawn: 5 minutes (300s), spawns at 5:00
  // Herald spawns at 8:00, despawns at 19:45

  for (const event of events) {
    if (event.EventName === 'BaronKill') {
      timers.baron.alive = false;
      timers.baron.respawnAt = event.EventTime + 360;
      timers.baron.lastKilledBy = event.KillerName || '';
    } else if (event.EventName === 'DragonKill') {
      if (event.DragonType === 'Elder') {
        timers.elderDragon.alive = false;
        timers.elderDragon.respawnAt = event.EventTime + 360;
        timers.elderDragon.lastKilledBy = event.KillerName || '';
      } else {
        timers.dragon.alive = false;
        timers.dragon.respawnAt = event.EventTime + 300;
        timers.dragon.lastKilledBy = event.KillerName || '';
        timers.dragon.dragonType = event.DragonType || '';
      }
    } else if (event.EventName === 'HeraldKill') {
      timers.herald.alive = false;
      timers.herald.respawnAt = event.EventTime + 360;
      timers.herald.lastKilledBy = event.KillerName || '';
    }
  }

  // Check if timers have expired (objective has respawned)
  for (const key of Object.keys(timers)) {
    if (!timers[key].alive && currentTime >= timers[key].respawnAt) {
      timers[key].alive = true;
    }
    timers[key].timeRemaining = timers[key].alive ? 0 : Math.max(0, timers[key].respawnAt - currentTime);
  }

  return timers;
}

/**
 * Format a single game event
 * @param {object} event - Raw event from Live Client Data API
 * @returns {object} formatted event
 */
function formatEvent(event) {
  return {
    type: event.EventName,
    time: event.EventTime,
    killer: event.KillerName || null,
    victim: event.VictimName || null,
    assisters: event.Assisters || [],
    dragonType: event.DragonType || null,
    turretKilled: event.TurretKilled || null,
    inhibKilled: event.InhibKilled || null,
    stolen: event.Stolen || false,
    data: event
  };
}

/**
 * Stop the live game poller
 */
function stopLiveGamePoller() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  isGameActive = false;
  console.log('[LiveGame] Poller stopped');
}

/**
 * Check if a game is currently active
 * @returns {boolean}
 */
function isGameRunning() {
  return isGameActive;
}

/**
 * Get accumulated gold history
 * @returns {Array}
 */
function getGoldHistory() {
  return goldHistory;
}

module.exports = {
  startLiveGamePoller,
  stopLiveGamePoller,
  isGameRunning,
  fetchLiveData,
  getGoldHistory
};
