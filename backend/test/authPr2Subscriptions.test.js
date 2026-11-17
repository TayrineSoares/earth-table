const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const {
  __setAuthDepsForTests,
  __resetAuthDepsForTests,
} = require('../src/middleware/requireAuth');

describe('PR2 subscription self-service auth', () => {
  let app;

  before(() => {
    app = require('../app');
  });

  beforeEach(() => {
    __setAuthDepsForTests({
      verifyBearerUser: async (token) => {
        if (token === 'user-token') return { id: 'user-1', email: 'user@example.com' };
        if (token === 'other-token') return { id: 'other-1', email: 'other@example.com' };
        return null;
      },
      loadUserRow: async (id) => ({
        auth_user_id: id,
        is_admin: false,
        email: `${id}@example.com`,
      }),
    });
  });

  afterEach(() => {
    __resetAuthDepsForTests();
  });

  after(() => {
    __resetAuthDepsForTests();
  });

  it('GET /subscriptions/mine without token → 401', async () => {
    const res = await request(app).get('/subscriptions/mine');
    assert.equal(res.status, 401);
  });

  it('POST /subscriptions/checkout without token → 401', async () => {
    const res = await request(app).post('/subscriptions/checkout').send({ email: 'a@b.com' });
    assert.equal(res.status, 401);
  });

  it('PATCH /subscriptions/:id/status without token → 401', async () => {
    const res = await request(app)
      .patch('/subscriptions/sub-1/status')
      .send({ action: 'pause' });
    assert.equal(res.status, 401);
  });

  it('body userId mismatch on checkout → 400', async () => {
    const res = await request(app)
      .post('/subscriptions/checkout')
      .set('Authorization', 'Bearer user-token')
      .send({ userId: 'other-1', email: 'user@example.com', planId: '1' });
    assert.equal(res.status, 400);
    assert.match(String(res.body?.error || ''), /userId/i);
  });

  it('body userId mismatch on status → 400', async () => {
    const res = await request(app)
      .patch('/subscriptions/sub-1/status')
      .set('Authorization', 'Bearer user-token')
      .send({ userId: 'other-1', action: 'pause' });
    assert.equal(res.status, 400);
    assert.match(String(res.body?.error || ''), /userId/i);
  });

  it('legacy GET /subscriptions/mine/:userId is not the mine route (401 without auth on catch-all manage)', async () => {
    // /mine/:userId was removed; /mine/:userId would not match GET /mine.
    // A stray path like /mine/user-1 is not public and requires auth.
    const res = await request(app).get('/subscriptions/mine/user-1');
    assert.equal(res.status, 401);
  });

  it('public GET /subscriptions/plans stays open', async () => {
    const res = await request(app).get('/subscriptions/plans?active=1');
    assert.notEqual(res.status, 401);
    assert.notEqual(res.status, 403);
  });

  it('public GET /subscriptions/dates stays open', async () => {
    const res = await request(app).get('/subscriptions/dates');
    assert.notEqual(res.status, 401);
    assert.notEqual(res.status, 403);
  });

  it('public GET /subscriptions/signup/:sessionId stays open', async () => {
    const res = await request(app).get('/subscriptions/signup/cs_test_missing');
    assert.notEqual(res.status, 401);
    assert.notEqual(res.status, 403);
  });
});
