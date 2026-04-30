'use strict';
const path = require('path');
const fs   = require('fs');

let _db = null;

/* ── Thin wrapper giving better-sqlite3-style sync API on top of sql.js ── */
class DB {
  constructor(sqlJsDb, filePath) {
    this._db  = sqlJsDb;
    this._path = filePath;
  }

  pragma(str) { this._db.run(`PRAGMA ${str}`); }

  exec(sql) { this._db.exec(sql); }

  _save() {
    if (this._path && this._path !== ':memory:') {
      const data = this._db.export();
      fs.mkdirSync(path.dirname(this._path), { recursive: true });
      fs.writeFileSync(this._path, Buffer.from(data));
    }
  }

  prepare(sql) {
    const db = this._db;
    const save = () => this._save();
    const isWrite = /^\s*(INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)/i.test(sql);
    return {
      run(...args) {
        const params = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
        db.run(sql, params);
        if (isWrite) save();
        return this;
      },
      get(...args) {
        const params = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
        const stmt = db.prepare(sql);
        stmt.bind(params);
        const row = stmt.step() ? stmt.getAsObject() : undefined;
        stmt.free();
        return row;
      },
      all(...args) {
        const params = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
        const rows = [];
        const stmt = db.prepare(sql);
        stmt.bind(params);
        while (stmt.step()) rows.push(stmt.getAsObject());
        stmt.free();
        return rows;
      },
    };
  }
}

/* ── Initialize (async once) ─────────────────────────────────────*/
const ready = (async () => {
  const initSqlJs = require('sql.js');
  const SQL       = await initSqlJs();

  const dbPath = process.env.DB_PATH === ':memory:'
    ? ':memory:'
    : path.resolve(process.env.DB_PATH || './data/app.db');

  let sqlJsDb;
  if (dbPath === ':memory:') {
    sqlJsDb = new SQL.Database();
  } else {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    sqlJsDb = fs.existsSync(dbPath)
      ? new SQL.Database(fs.readFileSync(dbPath))
      : new SQL.Database();
  }

  _db = new DB(sqlJsDb, dbPath === ':memory:' ? null : dbPath);
  _db.pragma('foreign_keys = ON');

  _db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      role          TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user','admin')),
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      last_login    TEXT
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS contact_submissions (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      email      TEXT NOT NULL,
      clinic     TEXT,
      message    TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  return _db;
})();

function getDb() {
  if (!_db) throw new Error('Database not ready — await db.ready first');
  return _db;
}

module.exports = { ready, getDb };
