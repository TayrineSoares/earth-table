const { createClient } = require('@supabase/supabase-js');
const { getUserByAuthId } = require('../queries/user');

function bearerToken(req) {
  const header = req.get('authorization') || '';
  if (!header.startsWith('Bearer ')) return '';
  return header.slice(7).trim();
}

async function defaultVerifyBearerUser(token) {
  if (!token) return null;
  const url = process.env.SUPABASE_PROJECT_URL;
  const anon = process.env.SUPABASE_ANON_KEY;
  if (!url || !anon) return null;

  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user?.id) return null;
  return { id: user.id, email: user.email || null };
}

let verifyBearerUser = defaultVerifyBearerUser;
let loadUserRow = getUserByAuthId;

function __setAuthDepsForTests(deps = {}) {
  if (deps.verifyBearerUser) verifyBearerUser = deps.verifyBearerUser;
  if (deps.loadUserRow) loadUserRow = deps.loadUserRow;
}

function __resetAuthDepsForTests() {
  verifyBearerUser = defaultVerifyBearerUser;
  loadUserRow = getUserByAuthId;
}

async function authUserFromBearer(req) {
  return verifyBearerUser(bearerToken(req));
}

async function requireAuth(req, res, next) {
  try {
    const user = await authUserFromBearer(req);
    if (!user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    req.user = user;
    next();
  } catch (err) {
    console.warn('[auth] requireAuth failed:', err.message);
    res.status(401).json({ error: 'Unauthorized' });
  }
}

async function requireAdmin(req, res, next) {
  try {
    const user = req.user || await authUserFromBearer(req);
    if (!user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    req.user = user;
    const row = await loadUserRow(user.id);
    if (!row?.is_admin) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    req.userRow = row;
    next();
  } catch (err) {
    console.warn('[auth] requireAdmin failed:', err.message);
    res.status(401).json({ error: 'Unauthorized' });
  }
}

/**
 * After requireAuth. Admin allowed; else params[paramName] must equal req.user.id.
 */
function requireSelfOrAdmin(paramName = 'auth_user_id') {
  return async function selfOrAdmin(req, res, next) {
    try {
      if (!req.user?.id) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      if (!req.userRow) {
        req.userRow = await loadUserRow(req.user.id);
      }
      if (req.userRow?.is_admin) {
        next();
        return;
      }
      const target = req.params[paramName];
      if (target && target === req.user.id) {
        next();
        return;
      }
      res.status(403).json({ error: 'Forbidden' });
    } catch (err) {
      console.warn('[auth] requireSelfOrAdmin failed:', err.message);
      res.status(401).json({ error: 'Unauthorized' });
    }
  };
}

/**
 * Skip middleware when request matches the public allowlist.
 * Entries: { method: 'GET' } (any path), or { method: 'GET', path: '/foo' },
 * or { method: 'GET', pattern: /^\/plans/ }.
 */
function unlessPublic(allowlist, middleware) {
  const rules = Array.isArray(allowlist) ? allowlist : [];
  return function publicOrAuth(req, res, next) {
    const method = String(req.method || '').toUpperCase();
    const path = req.path || '/';
    const allowed = rules.some((rule) => {
      if (!rule) return false;
      const ruleMethod = String(rule.method || '').toUpperCase();
      if (ruleMethod && ruleMethod !== method) return false;
      if (rule.pattern instanceof RegExp) return rule.pattern.test(path);
      if (rule.path != null) return path === rule.path;
      return true;
    });
    if (allowed) {
      next();
      return;
    }
    return middleware(req, res, next);
  };
}

async function loadCallerUserRow(req) {
  if (req.userRow) return req.userRow;
  if (!req.user?.id) return null;
  req.userRow = await loadUserRow(req.user.id);
  return req.userRow;
}

function isAdminUser(req) {
  return Boolean(req.userRow?.is_admin);
}

module.exports = {
  bearerToken,
  authUserFromBearer,
  requireAuth,
  requireAdmin,
  requireSelfOrAdmin,
  unlessPublic,
  loadCallerUserRow,
  isAdminUser,
  __setAuthDepsForTests,
  __resetAuthDepsForTests,
};
