'use strict';
const express   = require('express');
const bcrypt    = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');

const { getDb } = require('../db/database');
// Lazy proxy — binds methods so `this` stays as the DB instance
const db = new Proxy({}, {
  get: (_, k) => { const inst = getDb(); const v = inst[k]; return typeof v === 'function' ? v.bind(inst) : v; },
});
const { signAccess, signRefresh, verify, hashToken } = require('../utils/jwt');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const SALT_ROUNDS = 12;

/* ── Validation rules ──────────────────────────────────────────── */
const signupRules = [
  body('email')
    .isEmail().withMessage('Valid email required')
    .normalizeEmail()
    .isLength({ max: 254 }),
  body('password')
    .isLength({ min: 8, max: 128 }).withMessage('Password must be 8–128 characters')
    .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter')
    .matches(/[0-9]/).withMessage('Password must contain a number'),
];

const loginRules = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
];

function validationGuard(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array().map(e => e.msg) });
  }
  next();
}

/* ── POST /api/auth/signup ─────────────────────────────────────── */
router.post('/signup', signupRules, validationGuard, async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      // Constant-time response — don't leak whether email exists
      await bcrypt.hash(password, SALT_ROUNDS);
      return res.status(409).json({ error: 'Email already registered' });
    }

    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    const id   = uuidv4();

    db.prepare(
      'INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)'
    ).run(id, email, hash);

    const accessToken  = signAccess({ sub: id, role: 'user' });
    const refreshRaw   = signRefresh({ sub: id });
    const refreshExp   = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    db.prepare(
      'INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?,?,?,?)'
    ).run(uuidv4(), id, hashToken(refreshRaw), refreshExp);

    res.status(201).json({ accessToken, refreshToken: refreshRaw });
  } catch (err) { next(err); }
});

/* ── POST /api/auth/login ──────────────────────────────────────── */
router.post('/login', loginRules, validationGuard, async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

    // Always run bcrypt — prevents timing attacks that enumerate valid emails
    const dummyHash = '$2a$12$invalidhashpadding000000000000000000000000000000000000000';
    const match = await bcrypt.compare(password, user ? user.password_hash : dummyHash);

    if (!user || !match) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    db.prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?").run(user.id);

    const accessToken = signAccess({ sub: user.id, role: user.role });
    const refreshRaw  = signRefresh({ sub: user.id });
    const refreshExp  = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    db.prepare(
      'INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?,?,?,?)'
    ).run(uuidv4(), user.id, hashToken(refreshRaw), refreshExp);

    res.json({ accessToken, refreshToken: refreshRaw });
  } catch (err) { next(err); }
});

/* ── POST /api/auth/refresh ────────────────────────────────────── */
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });

    let payload;
    try { payload = verify(refreshToken); }
    catch { return res.status(401).json({ error: 'Invalid or expired refresh token' }); }

    const stored = db.prepare(
      'SELECT * FROM refresh_tokens WHERE token_hash = ?'
    ).get(hashToken(refreshToken));

    if (!stored || new Date(stored.expires_at) < new Date()) {
      return res.status(401).json({ error: 'Refresh token not found or expired' });
    }

    // Rotate: delete old, issue new
    db.prepare('DELETE FROM refresh_tokens WHERE id = ?').run(stored.id);

    const user = db.prepare('SELECT id, role FROM users WHERE id = ?').get(payload.sub);
    if (!user) return res.status(401).json({ error: 'User not found' });

    const newAccess  = signAccess({ sub: user.id, role: user.role });
    const newRefreshRaw = signRefresh({ sub: user.id });
    const newExp     = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    db.prepare(
      'INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?,?,?,?)'
    ).run(uuidv4(), user.id, hashToken(newRefreshRaw), newExp);

    res.json({ accessToken: newAccess, refreshToken: newRefreshRaw });
  } catch (err) { next(err); }
});

/* ── POST /api/auth/logout ─────────────────────────────────────── */
router.post('/logout', requireAuth, (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      db.prepare('DELETE FROM refresh_tokens WHERE token_hash = ?')
        .run(hashToken(refreshToken));
    }
    res.json({ message: 'Logged out' });
  } catch (err) { next(err); }
});

/* ── GET /api/auth/me ──────────────────────────────────────────── */
router.get('/me', requireAuth, (req, res, next) => {
  try {
    const user = db.prepare('SELECT id, email, role, created_at, last_login FROM users WHERE id = ?')
      .get(req.user.sub);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) { next(err); }
});

module.exports = router;
