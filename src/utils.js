// src/utils.js — Utility helpers: LAN IP detection, QR generation, config loading
const os = require('os');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');

/**
 * Detect the LAN IP address of this machine
 * @returns {string} LAN IP (e.g. "192.168.1.100") or "127.0.0.1" fallback
 */
function getLanIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal/loopback and non-IPv4
      if (iface.internal || iface.family !== 'IPv4') continue;
      return iface.address;
    }
  }
  return '127.0.0.1';
}

/**
 * Generate QR code as ASCII for the terminal + as a data URL for the web
 * @param {string} url — The URL to encode
 * @returns {Promise<{ascii: string, dataUrl: string}>}
 */
async function generateQR(url) {
  const ascii = await QRCode.toString(url, { type: 'terminal', small: true });
  const dataUrl = await QRCode.toDataURL(url, { width: 256, margin: 1 });
  return { ascii, dataUrl };
}

/**
 * Load and merge config.json with defaults
 * @returns {object} config
 */
function loadConfig() {
  const configPath = path.join(__dirname, '..', 'config.json');
  const defaults = {
    server: { port: 3003, pollIntervalMs: 500, lcuPollIntervalMs: 1000 },
    tournament: { name: 'LoL Tournament', shortName: 'LOL', logo: '', sponsors: [] },
    teams: {
      blue: { name: 'Blue Team', tag: 'BLU', logo: '', color: '#1a73e8' },
      red: { name: 'Red Team', tag: 'RED', logo: '', color: '#e53935' }
    },
    overlay: {
      showTimers: true, showGoldGraph: true, showMinimap: true,
      showBranding: true, showKillfeed: true, locale: 'vn', animationsEnabled: true
    },
    riotApi: { region: 'vn2', platform: 'VN2' }
  };

  try {
    const userConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return deepMerge(defaults, userConfig);
  } catch (err) {
    console.warn('[Config] Could not load config.json, using defaults:', err.message);
    return defaults;
  }
}

/**
 * Deep merge two objects (source values override target)
 */
function deepMerge(target, source) {
  const output = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      output[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      output[key] = source[key];
    }
  }
  return output;
}

/**
 * Load Vietnamese champion names
 * @returns {object} Map of champion key to VN name
 */
function loadChampionNames() {
  const vnPath = path.join(__dirname, '..', 'data', 'champions_vn.json');
  try {
    return JSON.parse(fs.readFileSync(vnPath, 'utf8'));
  } catch (err) {
    console.warn('[Data] Could not load VN champion names:', err.message);
    return {};
  }
}

module.exports = { getLanIP, generateQR, loadConfig, loadChampionNames, deepMerge };
