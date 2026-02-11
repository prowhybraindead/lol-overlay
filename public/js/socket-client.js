// socket-client.js — Shared Socket.io client for all overlay pages
// Auto-connects to the server, handles reconnection, provides event helpers

(function () {
  'use strict';

  // ─── Connect to the server ─────────────────────────────────────
  const socket = io({
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: Infinity,
    timeout: 5000
  });

  // ─── State ─────────────────────────────────────────────────────
  let connected = false;
  let currentState = {};
  let config = {};
  let ddragonVersion = '14.24.1';
  let champNamesVN = {};

  // ─── Connection Events ─────────────────────────────────────────
  socket.on('connect', () => {
    connected = true;
    console.log('[WS] Connected to overlay server');
    updateStatusBadge(true);
    // Fetch initial data
    fetchConfig();
    fetchDDragonVersion();
    fetchChampNamesVN();
  });

  socket.on('disconnect', () => {
    connected = false;
    console.log('[WS] Disconnected from server');
    updateStatusBadge(false);
  });

  socket.on('connect_error', (err) => {
    console.warn('[WS] Connection error:', err.message);
    updateStatusBadge(false);
  });

  // ─── Receive full state on connect ─────────────────────────────
  socket.on('fullState', (state) => {
    currentState = state;
    config = state.config || {};
    window.dispatchEvent(new CustomEvent('overlay:fullState', { detail: state }));
  });

  // ─── Game Data Events ──────────────────────────────────────────
  socket.on('gameData', (data) => {
    currentState.gameData = data;
    window.dispatchEvent(new CustomEvent('overlay:gameData', { detail: data }));
  });

  socket.on('champSelect', (data) => {
    currentState.champSelect = data;
    window.dispatchEvent(new CustomEvent('overlay:champSelect', { detail: data }));
  });

  socket.on('gameEvent', (event) => {
    window.dispatchEvent(new CustomEvent('overlay:gameEvent', { detail: event }));
  });

  socket.on('gamePhase', (data) => {
    currentState.phase = data.phase;
    window.dispatchEvent(new CustomEvent('overlay:gamePhase', { detail: data }));
  });

  socket.on('gameStart', () => {
    window.dispatchEvent(new CustomEvent('overlay:gameStart'));
  });

  socket.on('gameEnd', (data) => {
    window.dispatchEvent(new CustomEvent('overlay:gameEnd', { detail: data }));
  });

  socket.on('configUpdate', (cfg) => {
    config = cfg;
    currentState.config = cfg;
    window.dispatchEvent(new CustomEvent('overlay:configUpdate', { detail: cfg }));
  });

  socket.on('lcuStatus', (data) => {
    window.dispatchEvent(new CustomEvent('overlay:lcuStatus', { detail: data }));
  });

  // ─── Fetch Helpers ─────────────────────────────────────────────
  async function fetchConfig() {
    try {
      const res = await fetch('/api/config');
      config = await res.json();
      window.dispatchEvent(new CustomEvent('overlay:configLoaded', { detail: config }));
    } catch (err) {
      console.warn('[Client] Could not fetch config:', err.message);
    }
  }

  async function fetchDDragonVersion() {
    try {
      const res = await fetch('/api/ddragon/version');
      const data = await res.json();
      ddragonVersion = data.version;
      window.dispatchEvent(new CustomEvent('overlay:ddragonVersion', { detail: ddragonVersion }));
    } catch (err) {
      console.warn('[Client] Could not fetch DDragon version');
    }
  }

  async function fetchChampNamesVN() {
    try {
      const res = await fetch('/api/champions/vn');
      champNamesVN = await res.json();
    } catch (err) {
      console.warn('[Client] Could not fetch VN champion names');
    }
  }

  // ─── DataDragon URL Helpers ────────────────────────────────────
  function getChampionIcon(champName) {
    return `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/champion/${champName}.png`;
  }

  function getChampionSplash(champName, skinNum = 0) {
    return `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${champName}_${skinNum}.jpg`;
  }

  function getChampionLoading(champName, skinNum = 0) {
    return `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${champName}_${skinNum}.jpg`;
  }

  function getItemIcon(itemId) {
    return `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/item/${itemId}.png`;
  }

  function getSpellIcon(spellKey) {
    return `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/spell/${spellKey}.png`;
  }

  // Champion name resolver (raw name → display name)
  function resolveChampName(rawName) {
    // rawName is like "game_character_displayname_Ahri" or just "Ahri"
    const clean = rawName.replace('game_character_displayname_', '');
    // If VN names loaded, use them
    if (champNamesVN[clean]) return champNamesVN[clean];
    return clean;
  }

  // ─── Utility: Format game time ─────────────────────────────────
  function formatGameTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  // ─── Status Badge ──────────────────────────────────────────────
  function updateStatusBadge(isConnected) {
    let badge = document.getElementById('overlay-status-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'overlay-status-badge';
      badge.className = 'status-badge';
      badge.innerHTML = '<span class="status-dot"></span><span class="status-text"></span>';
      document.body.appendChild(badge);
    }
    badge.className = `status-badge ${isConnected ? 'connected' : 'disconnected'}`;
    badge.querySelector('.status-text').textContent = isConnected ? 'LIVE' : 'OFFLINE';
  }

  // ─── Expose Global API ─────────────────────────────────────────
  window.OverlayClient = {
    socket,
    getState: () => currentState,
    getConfig: () => config,
    getDDragonVersion: () => ddragonVersion,
    getChampNamesVN: () => champNamesVN,
    getChampionIcon,
    getChampionSplash,
    getChampionLoading,
    getItemIcon,
    getSpellIcon,
    resolveChampName,
    formatGameTime,
    isConnected: () => connected
  };

})();
