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
  body('clinicName').trim().isLength({ min: 1, max: 200 }).withMessage('Clinic name required'),
  body('phone').trim().isLength({ min: 1, max: 30 }).withMessage('Phone number required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('q1').optional().trim().isLength({ max: 100 }),
  body('q2').optional().trim().isLength({ max: 100 }),
  body('q3').optional().trim().isLength({ max: 100 }),
];

/* ── POST /api/contact ─────────────────────────────────────────── */
router.post('/', contactRules, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array().map(e => e.msg) });
    }

    const { firstName, lastName, clinicName, phone, email, q1, q2, q3 } = req.body;
    const id = uuidv4();

    db.prepare(`
      INSERT INTO contact_submissions (id, first_name, last_name, clinic_name, phone, email, q1, q2, q3)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, firstName, lastName, clinicName, phone, email, q1 || '', q2 || '', q3 || '');

    // Fire emails — don't let a mail failure block the 201 response
    Promise.all([
      sendLeadNotification({ firstName, lastName, clinicName, phone, email, q1, q2, q3 }),
      sendClientConfirmation({ firstName, email }),
    ]).catch(err => console.error('[mailer]', err.message));

    res.status(201).json({ message: 'Survey submitted! We\'ll be in touch within 1–2 business days.' });
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
