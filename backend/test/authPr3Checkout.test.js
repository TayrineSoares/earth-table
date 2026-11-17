const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const {
  __setAuthDepsForTests,
  __resetAuthDepsForTests,
} = require('../src/middleware/requireAuth');

describe('PR3 orders / cart / promo / checkout auth', () => {
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
      loadUserRow: async (id) => {
        if (id === 'user-1') {
          return { auth_user_id: 'user-1', is_admin: false, email: 'user@example.com' };
        }
        if (id === 'other-1') {
          return { auth_user_id: 'other-1', is_admin: false, email: 'other@example.com' };
        }
        return null;
      },
    });
  });

  afterEach(() => {
    __resetAuthDepsForTests();
  });

  after(() => {
    __resetAuthDepsForTests();
  });

  it('GET /orders/mine without token → 401', async () => {
    const res = await request(app).get('/orders/mine');
    assert.equal(res.status, 401);
  });

  it('GET /cart without token → 401', async () => {
    const res = await request(app).get('/cart');
    assert.equal(res.status, 401);
  });

  it('POST /promo/validate guest without userId → not 400 for identity', async () => {
    const res = await request(app)
      .post('/promo/validate')
      .send({ code: 'NOPE', subtotalCents: 1000 });
    // Missing/invalid code path — must not be "Sign in to use this userId"
    assert.notEqual(res.body?.message, 'Sign in to use this userId.');
    assert.notEqual(res.body?.error, 'Sign in to use this userId.');
  });

  it('POST /promo/validate guest with forged userId → 400', async () => {
    const res = await request(app)
      .post('/promo/validate')
      .send({ code: 'SAVE10', subtotalCents: 1000, userId: 'user-1' });
    assert.equal(res.status, 400);
    assert.match(String(res.body?.message || ''), /Sign in/i);
  });

  it('POST /promo/validate Bearer + mismatched userId → 400', async () => {
    const res = await request(app)
      .post('/promo/validate')
      .set('Authorization', 'Bearer user-token')
      .send({ code: 'SAVE10', subtotalCents: 1000, userId: 'other-1' });
    assert.equal(res.status, 400);
    assert.match(String(res.body?.message || ''), /does not match/i);
  });

  it('POST /api/create-checkout-session guest with forged userId → 400', async () => {
    const res = await request(app)
      .post('/api/create-checkout-session')
      .send({
        cartItems: [],
        userId: 'user-1',
        email: 'guest@example.com',
      });
    assert.equal(res.status, 400);
    assert.match(String(res.body?.error || ''), /Sign in/i);
  });

  it('POST /api/create-checkout-session Bearer + mismatched userId → 400', async () => {
    const res = await request(app)
      .post('/api/create-checkout-session')
      .set('Authorization', 'Bearer user-token')
      .send({
        cartItems: [],
        userId: 'other-1',
        email: 'user@example.com',
      });
    assert.equal(res.status, 400);
    assert.match(String(res.body?.error || ''), /does not match/i);
  });
});
