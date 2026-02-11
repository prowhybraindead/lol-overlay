// src/db.js — SQLite3 database initialization and queries
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

let db = null;

/**
 * Initialize SQLite database
 * Creates tables and seeds sample data if first run
 * @returns {Database} better-sqlite3 instance
 */
function initDB() {
  const dbPath = path.join(__dirname, '..', 'overlay.db');
  db = new Database(dbPath);

  // Enable WAL mode for better concurrent read performance
  db.pragma('journal_mode = WAL');

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      tag TEXT NOT NULL,
      logo TEXT DEFAULT '',
      school TEXT DEFAULT '',
      color TEXT DEFAULT '#ffffff',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS configs (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      blue_team_id TEXT,
      red_team_id TEXT,
      blue_score INTEGER DEFAULT 0,
      red_score INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (blue_team_id) REFERENCES teams(id),
      FOREIGN KEY (red_team_id) REFERENCES teams(id)
    );
  `);

  // Seed teams if table is empty
  const count = db.prepare('SELECT COUNT(*) as c FROM teams').get();
  if (count.c === 0) {
    seedTeams();
  }

  console.log('[DB] SQLite initialized at', dbPath);
  return db;
}

/**
 * Seed teams from data/teams.json
 */
function seedTeams() {
  const teamsPath = path.join(__dirname, '..', 'data', 'teams.json');
  try {
    const teams = JSON.parse(fs.readFileSync(teamsPath, 'utf8'));
    const insert = db.prepare(
      'INSERT OR IGNORE INTO teams (id, name, tag, logo, school, color) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const insertMany = db.transaction((teams) => {
      for (const t of teams) {
        insert.run(t.id, t.name, t.tag, t.logo || '', t.school || '', t.color || '#ffffff');
      }
    });
    insertMany(teams);
    console.log(`[DB] Seeded ${teams.length} teams`);
  } catch (err) {
    console.warn('[DB] Could not seed teams:', err.message);
  }
}

/**
 * Get all teams
 * @returns {Array} teams
 */
function getTeams() {
  return db.prepare('SELECT * FROM teams ORDER BY name').all();
}

/**
 * Get a team by ID
 * @param {string} id
 * @returns {object|undefined} team
 */
function getTeam(id) {
  return db.prepare('SELECT * FROM teams WHERE id = ?').get(id);
}

/**
 * Upsert a config value
 * @param {string} key
 * @param {string} value
 */
function setConfig(key, value) {
  db.prepare(
    'INSERT INTO configs (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP'
  ).run(key, value, value);
}

/**
 * Get a config value
 * @param {string} key
 * @returns {string|null}
 */
function getConfig(key) {
  const row = db.prepare('SELECT value FROM configs WHERE key = ?').get(key);
  return row ? row.value : null;
}

/**
 * Create a match record
 * @param {string} blueTeamId
 * @param {string} redTeamId
 * @returns {number} match ID
 */
function createMatch(blueTeamId, redTeamId) {
  const result = db.prepare(
    'INSERT INTO matches (blue_team_id, red_team_id) VALUES (?, ?)'
  ).run(blueTeamId, redTeamId);
  return result.lastInsertRowid;
}

/**
 * Get DB instance
 * @returns {Database}
 */
function getDB() {
  return db;
}

module.exports = { initDB, getTeams, getTeam, setConfig, getConfig, createMatch, getDB };
