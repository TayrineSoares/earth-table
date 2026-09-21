const crypto = require('crypto');

function hmacSecret() {
  return String(process.env.CRON_SECRET || '');
}

function sign(value) {
  return crypto.createHmac('sha256', hmacSecret()).update(`unsubscribe:${value}`).digest('base64url');
}

function createUnsubscribeToken(userId) {
  const id = String(userId || '');
  if (!id || !hmacSecret()) return '';
  const payload = Buffer.from(id, 'utf8').toString('base64url');
  return `${payload}.${sign(id)}`;
}

function verifyUnsubscribeToken(token) {
  const raw = String(token || '').trim();
  const dot = raw.lastIndexOf('.');
  if (dot < 1 || !hmacSecret()) return null;
  const payload = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  let userId;
  try {
    userId = Buffer.from(payload, 'base64url').toString('utf8');
  } catch {
    return null;
  }
  if (!userId) return null;
  const expected = sign(userId);
  const a = Buffer.from(String(sig));
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!crypto.timingSafeEqual(a, b)) return null;
  return userId;
}

function unsubscribeUrl(userId) {
  const token = createUnsubscribeToken(userId);
  if (!token) return '';
  const base = String(process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');
  return `${base}/unsubscribe?token=${encodeURIComponent(token)}`;
}

module.exports = {
  createUnsubscribeToken,
  verifyUnsubscribeToken,
  unsubscribeUrl,
};
