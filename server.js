// server.js — Main entry point: Express + Socket.io + LCU + Live Game + SQLite
// Binds to 0.0.0.0 for LAN access, generates QR code, pushes realtime data

require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server: SocketIO } = require('socket.io');
const path = require('path');

// Local modules
const { getLanIP, generateQR, loadConfig, loadChampionNames } = require('./src/utils');
const { initDB, getTeams, getTeam, setConfig, getConfig, createMatch } = require('./src/db');
const { startLCUPoller, stopLCUPoller, isLCUConnected } = require('./src/lcu-poller');
const { startLiveGamePoller, stopLiveGamePoller, isGameRunning, getGoldHistory } = require('./src/live-game');

// ─── Load Configuration ──────────────────────────────────────────────
const config = loadConfig();
const PORT = process.env.PORT || config.server.port || 3003;
const champNamesVN = loadChampionNames();

// ─── Express + Socket.io Setup ───────────────────────────────────────
const app = express();
const server = http.createServer(app);
const io = new SocketIO(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// ─── LeagueBroadcast Overlay Assets ──────────────────────────────────
// Serve the LeagueBroadcast ingame overlay from examples/
app.use('/ingame', express.static(path.join(__dirname, 'examples')));
// Serve style assets (announcer, killfeed, objectives, scoreboard images)
const lbRoaming = path.join(
  process.env.APPDATA || '', 'BlueBottle', 'LeagueBroadcast', 'hosted'
);
app.use('/style', express.static(path.join(lbRoaming, 'style')));
app.use('/font', express.static(path.join(lbRoaming, 'font')));
app.use('/game', express.static(path.join(lbRoaming, 'game')));
app.use('/season', express.static(path.join(lbRoaming, 'season')));

// ─── State ───────────────────────────────────────────────────────────
let currentState = {
  phase: 'idle',        // idle | champSelect | inGame | postGame
  champSelect: null,    // Pick/ban data
  gameData: null,       // In-game state
  events: [],           // Recent events (killfeed)
  config: config,       // Tournament config
  lcuConnected: false,
  gameActive: false
};

// ─── REST API Routes ─────────────────────────────────────────────────

// Get current full state
app.get('/api/state', (req, res) => {
  res.json(currentState);
});

// Get config
app.get('/api/config', (req, res) => {
  res.json(config);
});

// Update team config on the fly
app.post('/api/teams', (req, res) => {
  const { side, name, tag, logo, color } = req.body;
  if (side === 'blue' || side === 'red') {
    config.teams[side] = { ...config.teams[side], ...{ name, tag, logo, color } };
    currentState.config = config;
    io.emit('configUpdate', config);
    res.json({ ok: true, teams: config.teams });
  } else {
    res.status(400).json({ error: 'side must be "blue" or "red"' });
  }
});

// Get all teams from DB
app.get('/api/db/teams', (req, res) => {
  try {
    const teams = getTeams();
    res.json(teams);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Vietnamese champion names
app.get('/api/champions/vn', (req, res) => {
  res.json(champNamesVN);
});

// Get DataDragon version (proxy to avoid CORS in overlays)
app.get('/api/ddragon/version', async (req, res) => {
  try {
    const fetch = require('node-fetch');
    const resp = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
    const versions = await resp.json();
    res.json({ version: versions[0], versions: versions.slice(0, 5) });
  } catch (err) {
    res.json({ version: '14.24.1', versions: ['14.24.1'] }); // fallback
  }
});

// Server info (LAN IP, QR, status)
app.get('/api/info', async (req, res) => {
  const lanIP = getLanIP();
  const url = `http://${lanIP}:${PORT}`;
  const qr = await generateQR(url);
  res.json({
    lanIP,
    port: PORT,
    url,
    qrDataUrl: qr.dataUrl,
    lcuConnected: isLCUConnected(),
    gameActive: isGameRunning()
  });
});

// Gold history for graph
app.get('/api/gold-history', (req, res) => {
  res.json(getGoldHistory());
});

// ─── Socket.io Connection Handling ───────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[WS] Client connected: ${socket.id}`);

  // Send current state on connect
  socket.emit('fullState', currentState);

  // Handle admin commands
  socket.on('setTeam', (data) => {
    const { side, name, tag, logo, color } = data;
    if (side === 'blue' || side === 'red') {
      config.teams[side] = { ...config.teams[side], ...{ name, tag, logo, color } };
      currentState.config = config;
      io.emit('configUpdate', config);
    }
  });

  socket.on('disconnect', () => {
    console.log(`[WS] Client disconnected: ${socket.id}`);
  });
});

// ─── Initialize Database ─────────────────────────────────────────────
initDB();

// ─── Start LCU Poller (Pick/Ban) ─────────────────────────────────────
startLCUPoller({
  pollIntervalMs: config.server.lcuPollIntervalMs,

  onConnect: (credentials) => {
    currentState.lcuConnected = true;
    io.emit('lcuStatus', { connected: true });
    console.log('[Server] LCU connected');
  },

  onDisconnect: (err) => {
    currentState.lcuConnected = false;
    io.emit('lcuStatus', { connected: false });
    console.log('[Server] LCU disconnected');
  },

  onChampSelect: (data) => {
    currentState.phase = 'champSelect';
    currentState.champSelect = data;
    io.emit('champSelect', data);
  },

  onGameflow: (phase) => {
    console.log(`[Server] Gameflow phase: ${phase}`);
    if (phase === 'ChampSelect') {
      currentState.phase = 'champSelect';
    } else if (phase === 'InProgress' || phase === 'GameStart') {
      currentState.phase = 'inGame';
    } else if (phase === 'EndOfGame' || phase === 'PreEndOfGame') {
      currentState.phase = 'postGame';
    } else if (phase === 'Lobby' || phase === 'None') {
      currentState.phase = 'idle';
      currentState.champSelect = null;
      currentState.gameData = null;
      currentState.events = [];
    }
    io.emit('gamePhase', { phase: currentState.phase, rawPhase: phase });
  }
});

// ─── Start Live Game Poller (In-Game Stats) ──────────────────────────
startLiveGamePoller({
  pollIntervalMs: config.server.pollIntervalMs,

  onGameStart: () => {
    currentState.phase = 'inGame';
    currentState.gameActive = true;
    currentState.events = [];
    io.emit('gameStart', {});
    console.log('[Server] Game started');
  },

  onGameData: (data) => {
    currentState.gameData = data;
    currentState.gameActive = true;
    io.emit('gameData', data);
  },

  onGameEvent: (event) => {
    // Keep last 20 events for killfeed
    currentState.events.unshift(event);
    if (currentState.events.length > 20) currentState.events = currentState.events.slice(0, 20);
    io.emit('gameEvent', event);
  },

  onGameEnd: () => {
    currentState.phase = 'postGame';
    currentState.gameActive = false;
    io.emit('gameEnd', { finalData: currentState.gameData });
    console.log('[Server] Game ended');
  }
});

// ─── Start Server ────────────────────────────────────────────────────
server.listen(PORT, '0.0.0.0', async () => {
  const lanIP = getLanIP();
  const url = `http://${lanIP}:${PORT}`;

  console.log('');
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║   🎮 VN Student LoL Overlay — Server Running!       ║');
  console.log('╠═══════════════════════════════════════════════════════╣');
  console.log(`║   Local:    http://localhost:${PORT}                    ║`);
  console.log(`║   LAN:      ${url.padEnd(42)}║`);
  console.log('╠═══════════════════════════════════════════════════════╣');
  console.log('║   Overlays:                                         ║');
  console.log(`║   • Scoreboard:  ${url}/                `.slice(0, 56) + '║');
  console.log(`║   • Pick/Ban:    ${url}/pickban.html     `.slice(0, 56) + '║');
  console.log(`║   • Gold Graph:  ${url}/gold-graph.html  `.slice(0, 56) + '║');
  console.log(`║   • Minimap:     ${url}/minimap.html     `.slice(0, 56) + '║');
  console.log(`║   • Branding:    ${url}/branding.html    `.slice(0, 56) + '║');
  console.log('╚═══════════════════════════════════════════════════════╝');
  console.log('');

  // Generate and display QR code
  try {
    const qr = await generateQR(url);
    console.log('[QR] Scan to connect from LAN:');
    console.log(qr.ascii);
  } catch (err) {
    console.log('[QR] Could not generate QR:', err.message);
  }

  console.log('');
  console.log('[Tip] Add overlay URLs as "Browser Source" in OBS (1920x1080, transparent)');
  console.log('[Tip] Set RIOT_API_KEY in .env for Spectator API fallback');
  console.log('');
});

// ─── Graceful Shutdown ───────────────────────────────────────────────
process.on('SIGINT', () => {
  console.log('\n[Server] Shutting down...');
  stopLCUPoller();
  stopLiveGamePoller();
  server.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  stopLCUPoller();
  stopLiveGamePoller();
  server.close();
  process.exit(0);
});
