'use strict';
require('./setup');
const { ready } = require('../src/db/database');
const request   = require('supertest');
const app       = require('../src/app');

beforeAll(() => ready);

// Helpers
async function signup(email, password = 'Password1') {
  return request(app).post('/api/auth/signup').send({ email, password });
}
async function login(email, password = 'Password1') {
  return request(app).post('/api/auth/login').send({ email, password });
}

/* ── Signup ──────────────────────────────────────────────────────*/
describe('POST /api/auth/signup', () => {
  const EMAIL = 'signup@example.com';

  it('creates a user and returns tokens', async () => {
    const res = await signup(EMAIL);
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
  });

  it('rejects duplicate email', async () => {
    await signup(EMAIL);
    const res = await signup(EMAIL);
    expect(res.status).toBe(409);
  });

  it('rejects invalid email', async () => {
    const res = await request(app).post('/api/auth/signup')
      .send({ email: 'not-an-email', password: 'Password1' });
    expect(res.status).toBe(422);
  });

  it('rejects weak password (too short)', async () => {
    const res = await signup('short@example.com', 'abc');
    expect(res.status).toBe(422);
  });

  it('rejects password with no uppercase', async () => {
    const res = await signup('noupper@example.com', 'password1');
    expect(res.status).toBe(422);
  });

  it('rejects password with no number', async () => {
    const res = await signup('nonum@example.com', 'Password');
    expect(res.status).toBe(422);
  });

  it('rejects empty body', async () => {
    const res = await request(app).post('/api/auth/signup').send({});
    expect(res.status).toBe(422);
  });
});

/* ── Login ───────────────────────────────────────────────────────*/
describe('POST /api/auth/login', () => {
  const EMAIL = 'login@example.com';

  beforeAll(() => signup(EMAIL));

  it('returns tokens for valid credentials', async () => {
    const res = await login(EMAIL);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
  });

  it('rejects wrong password', async () => {
    const res = await login(EMAIL, 'WrongPass1');
    expect(res.status).toBe(401);
  });

  it('rejects unknown email', async () => {
    const res = await login('nobody@example.com');
    expect(res.status).toBe(401);
  });

  it('returns same error for bad email vs bad password (no user enumeration)', async () => {
    const badEmail = await login('ghost@example.com');
    const badPass  = await login(EMAIL, 'WrongPass1');
    expect(badEmail.body.error).toBe(badPass.body.error);
  });
});

/* ── /me (protected) ─────────────────────────────────────────────*/
describe('GET /api/auth/me', () => {
  const EMAIL = 'me@example.com';
  let accessToken;

  beforeAll(async () => {
    await signup(EMAIL);
    const res = await login(EMAIL);
    accessToken = res.body.accessToken;
  });

  it('returns profile with valid token', async () => {
    const res = await request(app).get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(EMAIL);
    expect(res.body).not.toHaveProperty('password_hash');
  });

  it('rejects missing token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('rejects tampered token', async () => {
    const tampered = accessToken.slice(0, -4) + 'xxxx';
    const res = await request(app).get('/api/auth/me')
      .set('Authorization', `Bearer ${tampered}`);
    expect(res.status).toBe(401);
  });

  it('rejects Bearer with no token value', async () => {
    const res = await request(app).get('/api/auth/me')
      .set('Authorization', 'Bearer ');
    expect(res.status).toBe(401);
  });
});

/* ── Refresh ─────────────────────────────────────────────────────*/
describe('POST /api/auth/refresh', () => {
  const EMAIL = 'refresh@example.com';

  beforeAll(() => signup(EMAIL));

  it('issues new tokens', async () => {
    const { body } = await login(EMAIL);
    const res = await request(app).post('/api/auth/refresh')
      .send({ refreshToken: body.refreshToken });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
  });

  it('rejects a replayed (already rotated) refresh token', async () => {
    const { body }  = await login(EMAIL);
    const refreshToken = body.refreshToken;

    const first  = await request(app).post('/api/auth/refresh').send({ refreshToken });
    const replay = await request(app).post('/api/auth/refresh').send({ refreshToken });

    expect(first.status).toBe(200);
    expect(replay.status).toBe(401);
  });

  it('rejects garbage token', async () => {
    const res = await request(app).post('/api/auth/refresh')
      .send({ refreshToken: 'garbage.token.value' });
    expect(res.status).toBe(401);
  });
});

/* ── Logout ──────────────────────────────────────────────────────*/
describe('POST /api/auth/logout', () => {
  const EMAIL = 'logout@example.com';

  beforeAll(() => signup(EMAIL));

  it('returns 200 for authenticated user', async () => {
    const { body } = await login(EMAIL);
    const res = await request(app).post('/api/auth/logout')
      .set('Authorization', `Bearer ${body.accessToken}`)
      .send({ refreshToken: body.refreshToken });
    expect(res.status).toBe(200);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(401);
  });
});
