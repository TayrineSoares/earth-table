const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const {
  __setAuthDepsForTests,
  __resetAuthDepsForTests,
} = require('../src/middleware/requireAuth');

describe('PR1 API auth gates', () => {
  let app;

  before(() => {
    app = require('../app');
  });

  beforeEach(() => {
    __setAuthDepsForTests({
      verifyBearerUser: async (token) => {
        if (token === 'user-token') return { id: 'user-1', email: 'user@example.com' };
        if (token === 'admin-token') return { id: 'admin-1', email: 'admin@example.com' };
        if (token === 'other-token') return { id: 'other-1', email: 'other@example.com' };
        return null;
      },
      loadUserRow: async (id) => {
        if (id === 'admin-1') {
          return { auth_user_id: 'admin-1', is_admin: true, email: 'admin@example.com' };
        }
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

  it('GET /users without token → 401', async () => {
    const res = await request(app).get('/users');
    assert.equal(res.status, 401);
  });

  it('GET /orders without token → 401', async () => {
    const res = await request(app).get('/orders');
    assert.equal(res.status, 401);
  });

  it('GET /orders/user/:id without token → 401', async () => {
    const res = await request(app).get('/orders/user/user-1');
    assert.equal(res.status, 401);
  });

  it('GET /subscriptions/admin without token → 401', async () => {
    const res = await request(app).get('/subscriptions/admin');
    assert.equal(res.status, 401);
  });

  it('GET /subscriptions/settings without token → 401', async () => {
    const res = await request(app).get('/subscriptions/settings');
    assert.equal(res.status, 401);
  });

  it('GET /partners without token → 401', async () => {
    const res = await request(app).get('/partners');
    assert.equal(res.status, 401);
  });

  it('GET /partners/by-user/:id without token → 401', async () => {
    const res = await request(app).get('/partners/by-user/user-1');
    assert.equal(res.status, 401);
  });

  it('GET /partners/invoices/:id/pdf without token → 401', async () => {
    const res = await request(app).get('/partners/invoices/inv-1/pdf');
    assert.equal(res.status, 401);
  });

  it('POST /products without token → 401', async () => {
    const res = await request(app).post('/products').send({ slug: 'x' });
    assert.equal(res.status, 401);
  });

  it('POST /categories without token → 401', async () => {
    const res = await request(app).post('/categories').send({ name: 'x' });
    assert.equal(res.status, 401);
  });

  it('non-admin GET /users → 403', async () => {
    const res = await request(app)
      .get('/users')
      .set('Authorization', 'Bearer user-token');
    assert.equal(res.status, 403);
  });

  it('non-admin GET /orders → 403', async () => {
    const res = await request(app)
      .get('/orders')
      .set('Authorization', 'Bearer user-token');
    assert.equal(res.status, 403);
  });

  it('non-owner GET /partners/by-user/:id → 403', async () => {
    const res = await request(app)
      .get('/partners/by-user/user-1')
      .set('Authorization', 'Bearer other-token');
    assert.equal(res.status, 403);
  });

  it('non-owner GET /orders/user/:id → 403', async () => {
    const res = await request(app)
      .get('/orders/user/user-1')
      .set('Authorization', 'Bearer other-token');
    assert.equal(res.status, 403);
  });

  it('non-admin GET /users/:id for another user → 403', async () => {
    const res = await request(app)
      .get('/users/user-1')
      .set('Authorization', 'Bearer other-token');
    assert.equal(res.status, 403);
  });

  it('non-admin cannot include is_admin in PATCH (stripped before update)', async () => {
    // Self patch is allowed through auth; is_admin must be stripped.
    // If Supabase is unreachable this may 500 after auth — assert we never 200 with is_admin true.
    const res = await request(app)
      .patch('/users/user-1')
      .set('Authorization', 'Bearer user-token')
      .send({ first_name: 'Pat', is_admin: true });

    if (res.status === 200) {
      assert.equal(Boolean(res.body?.is_admin), false);
    } else {
      // Auth passed; failure is DB-side, not Forbidden from trying to escalate alone.
      assert.notEqual(res.status, 403);
      assert.notEqual(res.status, 401);
    }
  });

  it('public catalog GET /products still open', async () => {
    const res = await request(app).get('/products');
    // May 200 or 500 depending on DB; must not be 401
    assert.notEqual(res.status, 401);
    assert.notEqual(res.status, 403);
  });

  it('orders session capability URL stays public', async () => {
    const res = await request(app).get('/orders/session/cs_test_missing');
    assert.notEqual(res.status, 401);
    assert.notEqual(res.status, 403);
  });
});
