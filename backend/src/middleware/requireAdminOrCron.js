const crypto = require('crypto');
const {
  authUserFromBearer,
  loadCallerUserRow,
} = require('./requireAuth');
const { getUserByAuthId } = require('../queries/user');

function secretsEqual(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  if (left.length !== right.length || left.length === 0) return false;
  return crypto.timingSafeEqual(left, right);
}

function cronAuthorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.get('authorization') || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : '';
  const alt = req.get('x-cron-secret') || '';
  return secretsEqual(bearer, secret) || secretsEqual(alt, secret);
}

async function adminUserFromBearer(req) {
  const user = await authUserFromBearer(req);
  if (!user?.id) return null;
  req.user = user;
  const row = await getUserByAuthId(user.id);
  if (!row?.is_admin) return null;
  req.userRow = row;
  return row;
}

/**
 * Force charge/lock and similar money jobs: cron secret or signed-in admin.
 */
async function requireAdminOrCron(req, res, next) {
  if (cronAuthorized(req)) {
    next();
    return;
  }
  try {
    const admin = await adminUserFromBearer(req);
    if (admin) {
      next();
      return;
    }
  } catch (err) {
    console.warn('[auth] admin check failed:', err.message);
  }
  res.status(401).json({ error: 'Unauthorized' });
}

module.exports = {
  requireAdminOrCron,
  cronAuthorized,
  adminUserFromBearer,
  // re-export for callers that previously only used this file
  loadCallerUserRow,
};
