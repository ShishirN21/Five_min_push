'use strict';
require('./setup');
const { ready } = require('../src/db/database');
const request   = require('supertest');
const app       = require('../src/app');

beforeAll(() => ready);

/* ── Security headers (Helmet) ───────────────────────────────────*/
describe('Security headers', () => {
  it('sets X-Content-Type-Options: nosniff', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('sets X-Frame-Options', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-frame-options']).toBeDefined();
  });

  it('does not expose X-Powered-By', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('sets Content-Security-Policy', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['content-security-policy']).toBeDefined();
  });
});

/* ── Injection attacks ───────────────────────────────────────────*/
describe('SQL injection protection', () => {
  it('handles SQL injection in email field gracefully', async () => {
    const res = await request(app).post('/api/auth/login')
      .send({ email: "' OR '1'='1", password: 'Password1' });
    expect([401, 422]).toContain(res.status);
    expect(res.body).not.toHaveProperty('accessToken');
  });

  it('handles SQL injection in password field', async () => {
    const res = await request(app).post('/api/auth/login')
      .send({ email: 'test@test.com', password: "' OR '1'='1'--" });
    expect([401, 422]).toContain(res.status);
  });
});

/* ── Oversized payloads ──────────────────────────────────────────*/
describe('Payload size limits', () => {
  it('rejects body larger than 16kb', async () => {
    const huge = { email: 'a@b.com', password: 'x'.repeat(20000) };
    const res  = await request(app).post('/api/auth/login').send(huge);
    expect([400, 413, 422]).toContain(res.status);
  });
});

/* ── Password field never leaks ──────────────────────────────────*/
describe('Sensitive data leakage', () => {
  beforeAll(async () => {
    await request(app).post('/api/auth/signup')
      .send({ email: 'sec@example.com', password: 'Password1' });
  });

  it('never returns password_hash in /me response', async () => {
    const login = await request(app).post('/api/auth/login')
      .send({ email: 'sec@example.com', password: 'Password1' });
    const me = await request(app).get('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`);
    expect(me.body).not.toHaveProperty('password_hash');
    expect(me.body).not.toHaveProperty('password');
    expect(JSON.stringify(me.body)).not.toContain('$2a$');
  });

  it('never returns password_hash in signup response', async () => {
    const res = await request(app).post('/api/auth/signup')
      .send({ email: 'sec2@example.com', password: 'Password1' });
    expect(JSON.stringify(res.body)).not.toContain('password');
  });
});

/* ── CORS ────────────────────────────────────────────────────────*/
describe('CORS', () => {
  it('blocks requests from unlisted origins', async () => {
    const res = await request(app).get('/api/health')
      .set('Origin', 'https://evil-attacker.com');
    expect(res.status).toBe(500); // CORS middleware throws, global handler returns 500
  });

  it('allows requests from allowed origin', async () => {
    const res = await request(app).get('/api/health')
      .set('Origin', 'http://localhost:8765');
    expect(res.status).toBe(200);
  });
});

/* ── Contact form XSS / injection ───────────────────────────────*/
describe('Contact form validation', () => {
  it('rejects empty message', async () => {
    const res = await request(app).post('/api/contact')
      .send({ name: 'Test', email: 'a@b.com', message: '' });
    expect(res.status).toBe(422);
  });

  it('rejects invalid email', async () => {
    const res = await request(app).post('/api/contact')
      .send({ name: 'Test', email: 'not-email', message: 'Hello there clinic partner' });
    expect(res.status).toBe(422);
  });

  it('accepts valid contact submission', async () => {
    const res = await request(app).post('/api/contact').send({
      name: 'Dr. Smith',
      email: 'dr@clinic.com',
      clinic: 'Smith Wellness',
      message: 'Interested in partnering with Five Mins Push Drop for our clinic.',
    });
    expect(res.status).toBe(201);
  });

  it('rejects oversized message', async () => {
    const res = await request(app).post('/api/contact').send({
      name: 'Test',
      email: 'a@b.com',
      message: 'x'.repeat(2001),
    });
    expect(res.status).toBe(422);
  });
});

/* ── 404 handling ────────────────────────────────────────────────*/
describe('Unknown routes', () => {
  it('returns 404 for unknown endpoints', async () => {
    const res = await request(app).get('/api/doesnotexist');
    expect(res.status).toBe(404);
  });
});
