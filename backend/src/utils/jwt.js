'use strict';
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const secret = process.env.JWT_SECRET || 'fallback-dev-secret-not-for-production-use-only';
if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
  console.warn('[jwt] WARNING: JWT_SECRET not set — auth routes disabled');
}

function signAccess(payload) {
  return jwt.sign(payload, secret, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    algorithm: 'HS256',
  });
}

function signRefresh(payload) {
  return jwt.sign(
    { ...payload, jti: crypto.randomBytes(16).toString('hex') },
    secret,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d', algorithm: 'HS256' }
  );
}

function verify(token) {
  return jwt.verify(token, secret, { algorithms: ['HS256'] });
}

function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

module.exports = { signAccess, signRefresh, verify, hashToken };
