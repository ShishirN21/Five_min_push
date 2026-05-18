'use strict';
require('dotenv').config();
const path       = require('path');
const express    = require('express');
const siteRoot   = path.resolve(__dirname, '../..');
const helmet     = require('helmet');
const cors       = require('cors');
const morgan     = require('morgan');
const rateLimit  = require('express-rate-limit');

const authRoutes    = require('./routes/auth');
const contactRoutes = require('./routes/contact');

const app = express();

/* ── Security headers ──────────────────────────────────────────── */
app.use(helmet());

/* ── CORS ───────────────────────────────────────────────────────── */
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim());
app.use(cors({
  origin(origin, cb) {
    // allow server-to-server (no Origin header) and listed origins
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

/* ── Body parser ─────────────────────────────────────────────────*/
app.use(express.json({ limit: '16kb' }));   // tight limit — no mega payloads

/* ── Logging (skip in test) ──────────────────────────────────────*/
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

/* ── Global rate limits (disabled in test) ───────────────────────*/
if (process.env.NODE_ENV !== 'test') {
  app.use('/api/', rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
  }));

  app.use('/api/auth/', rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { error: 'Too many auth attempts, please wait 15 minutes.' },
  }));
}

/* ── Routes ──────────────────────────────────────────────────────*/
app.use('/api/auth',    authRoutes);
app.use('/api/contact', contactRoutes);

/* ── Health check ────────────────────────────────────────────────*/
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

/* ── Static site (project root) ──────────────────────────────────*/
if (process.env.NODE_ENV !== 'test') {
  app.use(express.static(siteRoot));
}

/* ── 404 ─────────────────────────────────────────────────────────*/
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

/* ── Global error handler ────────────────────────────────────────*/
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  // never leak stack traces to clients
  const message = process.env.NODE_ENV === 'production' && status === 500
    ? 'Internal server error'
    : err.message;
  res.status(status).json({ error: message });
});

module.exports = app;
