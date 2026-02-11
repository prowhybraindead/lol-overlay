// src/lcu-poller.js — League Client (LCU) API poller for Pick/Ban phase
// Uses league-connect to authenticate with the LCU lockfile
const { authenticate, createHttp1Request, createWebSocketConnection } = require('league-connect');

let lcuCredentials = null;
let lcuWs = null;
let isConnected = false;
let pollTimer = null;

/**
 * Start the LCU poller
 * @param {object} options
 * @param {number} options.pollIntervalMs - Polling interval in ms
 * @param {function} options.onChampSelect - Callback when champ select data changes
 * @param {function} options.onGameflow - Callback when gameflow state changes
 * @param {function} options.onConnect - Callback when LCU is connected
 * @param {function} options.onDisconnect - Callback when LCU disconnects
 */
async function startLCUPoller({ pollIntervalMs = 1000, onChampSelect, onGameflow, onConnect, onDisconnect }) {
  console.log('[LCU] Waiting for League Client...');

  try {
    // Authenticate with the LCU — this will wait until the client is open
    lcuCredentials = await authenticate({
      awaitConnection: true,
      pollInterval: 2000
    });

    isConnected = true;
    console.log(`[LCU] Connected! Port: ${lcuCredentials.port}, PID: ${lcuCredentials.pid}`);
    if (onConnect) onConnect(lcuCredentials);

    // Try to set up WebSocket for real-time events
    try {
      lcuWs = await createWebSocketConnection(lcuCredentials);

      // Subscribe to champion selection events
      lcuWs.subscribe('/lol-champ-select/v1/session', (data, event) => {
        if (onChampSelect) onChampSelect(formatChampSelectData(data));
      });

      // Subscribe to gameflow events
      lcuWs.subscribe('/lol-gameflow/v1/gameflow-phase', (data, event) => {
        if (onGameflow) onGameflow(data);
      });

      console.log('[LCU] WebSocket subscriptions active');
    } catch (wsErr) {
      console.warn('[LCU] WebSocket failed, falling back to polling:', wsErr.message);
      // Fallback: poll via HTTP
      startPolling(pollIntervalMs, onChampSelect, onGameflow);
    }

  } catch (err) {
    console.error('[LCU] Connection failed:', err.message);
    isConnected = false;
    if (onDisconnect) onDisconnect(err);

    // Retry after 5 seconds
    setTimeout(() => {
      startLCUPoller({ pollIntervalMs, onChampSelect, onGameflow, onConnect, onDisconnect });
    }, 5000);
  }
}

/**
 * HTTP polling fallback for LCU data
 */
function startPolling(intervalMs, onChampSelect, onGameflow) {
  let lastPhase = null;

  pollTimer = setInterval(async () => {
    if (!lcuCredentials) return;

    try {
      // Poll gameflow phase
      const phaseRes = await createHttp1Request({
        method: 'GET',
        url: '/lol-gameflow/v1/gameflow-phase'
      }, lcuCredentials);

      const phase = phaseRes.json();
      if (phase !== lastPhase) {
        lastPhase = phase;
        if (onGameflow) onGameflow(phase);
      }

      // If in champ select, poll session
      if (phase === 'ChampSelect') {
        const sessionRes = await createHttp1Request({
          method: 'GET',
          url: '/lol-champ-select/v1/session'
        }, lcuCredentials);

        const session = sessionRes.json();
        if (onChampSelect) onChampSelect(formatChampSelectData(session));
      }
    } catch (err) {
      // Silently ignore polling errors (game might not be in champ select)
    }
  }, intervalMs);
}

/**
 * Format raw champ select session data into a clean structure
 * @param {object} session - Raw LCU champ select session
 * @returns {object} Formatted data
 */
function formatChampSelectData(session) {
  if (!session || !session.actions) {
    return { phase: 'unknown', bans: [], picks: [], timer: null };
  }

  const bans = [];
  const picks = [];

  // Flatten actions array (it's an array of arrays/rounds)
  for (const round of session.actions) {
    for (const action of round) {
      const entry = {
        championId: action.championId,
        teamId: action.isAllyAction ? 'blue' : 'red',
        isCompleted: action.completed,
        actorCellId: action.actorCellId,
        type: action.type // 'ban' or 'pick'
      };

      if (action.type === 'ban' && action.championId > 0) {
        bans.push(entry);
      } else if (action.type === 'pick' && action.championId > 0) {
        picks.push(entry);
      }
    }
  }

  // Extract player info from myTeam and theirTeam
  const blueTeam = (session.myTeam || []).map(p => ({
    cellId: p.cellId,
    championId: p.championId,
    summonerId: p.summonerId,
    spell1Id: p.spell1Id,
    spell2Id: p.spell2Id,
    assignedPosition: p.assignedPosition
  }));

  const redTeam = (session.theirTeam || []).map(p => ({
    cellId: p.cellId,
    championId: p.championId,
    summonerId: p.summonerId,
    spell1Id: p.spell1Id,
    spell2Id: p.spell2Id,
    assignedPosition: p.assignedPosition
  }));

  return {
    phase: session.timer ? session.timer.phase : 'PLANNING',
    timer: session.timer ? {
      totalTimeMs: session.timer.totalTimeInPhase,
      adjustedTimeMs: session.timer.adjustedTimeLeftInPhase,
      internalNow: session.timer.internalNowInEpochMs
    } : null,
    bans,
    picks,
    blueTeam,
    redTeam,
    localPlayerCellId: session.localPlayerCellId
  };
}

/**
 * Make an LCU API request
 * @param {string} method - HTTP method
 * @param {string} url - LCU endpoint
 * @returns {Promise<object>} response data
 */
async function lcuRequest(method, url) {
  if (!lcuCredentials) throw new Error('LCU not connected');
  const res = await createHttp1Request({ method, url }, lcuCredentials);
  return res.json();
}

/**
 * Stop the LCU poller
 */
function stopLCUPoller() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  if (lcuWs) {
    lcuWs.close();
    lcuWs = null;
  }
  isConnected = false;
  lcuCredentials = null;
  console.log('[LCU] Poller stopped');
}

/**
 * Check if LCU is connected
 * @returns {boolean}
 */
function isLCUConnected() {
  return isConnected;
}

module.exports = { startLCUPoller, stopLCUPoller, isLCUConnected, lcuRequest };
