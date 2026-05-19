'use strict';
const express = require('express');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/database');
const { sendLeadNotification, sendClientConfirmation } = require('../utils/mailer');
const { requireAdmin } = require('../middleware/auth');

const db = new Proxy({}, {
  get: (_, k) => { const inst = getDb(); const v = inst[k]; return typeof v === 'function' ? v.bind(inst) : v; },
});

const router = express.Router();

const contactRules = [
  body('firstName').trim().isLength({ min: 1, max: 50 }).withMessage('First name required'),
  body('lastName').trim().isLength({ min: 1, max: 50 }).withMessage('Last name required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
];

/* ── POST /api/contact ─────────────────────────────────────────── */
router.post('/', contactRules, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array().map(e => e.msg) });
    }

    const { firstName, lastName, email } = req.body;
    const id = uuidv4();

    db.prepare(`
      INSERT INTO contact_submissions (id, first_name, last_name, email)
      VALUES (?, ?, ?, ?)
    `).run(id, firstName, lastName, email);

    // Fire emails — don't let a mail failure block the 201 response
    Promise.all([
      sendLeadNotification({ firstName, lastName, email }),
      sendClientConfirmation({ firstName, email }),
    ]).catch(err => console.error('[mailer]', err.message));

    res.status(201).json({ message: 'Inquiry received. We\'ll be in touch soon!' });
  } catch (err) { next(err); }
});

/* ── GET /api/contact (admin only) ────────────────────────────── */
router.get('/', requireAdmin, (req, res, next) => {
  try {
    const rows = db.prepare(
      'SELECT * FROM contact_submissions ORDER BY created_at DESC LIMIT 100'
    ).all();
    res.json(rows);
  } catch (err) { next(err); }
});

module.exports = router;
