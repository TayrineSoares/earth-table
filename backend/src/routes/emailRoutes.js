const express = require('express');
const router = express.Router();
const { getUserByAuthId, updateUserByAuthId } = require('../queries/user');
const { verifyUnsubscribeToken } = require('../emails/unsubscribeToken');

async function unsubscribeReminders(userId) {
  const user = await getUserByAuthId(userId);
  if (!user) {
    const err = new Error('Account not found.');
    err.status = 404;
    throw err;
  }
  const prefs = user.email_prefs && typeof user.email_prefs === 'object' && !Array.isArray(user.email_prefs)
    ? { ...user.email_prefs }
    : {};
  prefs.wednesday_reminder = false;
  prefs.pause_reminder = false;
  await updateUserByAuthId(userId, { email_prefs: prefs });
  return { ok: true };
}

router.post('/unsubscribe', async (req, res) => {
  const token = req.body?.token || req.query?.token;
  const userId = verifyUnsubscribeToken(token);
  if (!userId) {
    return res.status(400).json({ error: 'This unsubscribe link is invalid.' });
  }
  try {
    await unsubscribeReminders(userId);
    return res.json({ ok: true });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error('[email/unsubscribe]', err.message);
    return res.status(status).json({
      error: status === 404 ? 'Account not found.' : 'Could not unsubscribe.',
    });
  }
});

module.exports = router;
