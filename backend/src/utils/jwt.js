'use strict';
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const secret = process.env.JWT_SECRET || null;
const jwtReady = secret && secret.length >= 32;
if (!jwtReady) console.warn('[jwt] JWT_SECRET not set — auth routes will return 503');

function assertReady() {
  if (!jwtReady) throw Object.assign(new Error('Auth unavailable — JWT_SECRET not configured'), { status: 503 });
}

function signAccess(payload) {
  assertReady();
  return jwt.sign(payload, secret, { expiresIn: process.env.JWT_EXPIRES_IN || '15m', algorithm: 'HS256' });
}

function signRefresh(payload) {
  assertReady();
  return jwt.sign(
    { ...payload, jti: crypto.randomBytes(16).toString('hex') },
    secret,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d', algorithm: 'HS256' }
  );
}

function verify(token) {
  assertReady();
  return jwt.verify(token, secret, { algorithms: ['HS256'] });
}

function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

module.exports = { signAccess, signRefresh, verify, hashToken };
