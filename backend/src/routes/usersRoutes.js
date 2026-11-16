const express = require('express');
const router = express.Router();
const { getAllUsers, getUserByAuthId, updateUserByAuthId } = require('../queries/user');
const {
  requireAuth,
  requireAdmin,
  requireSelfOrAdmin,
  loadCallerUserRow,
} = require('../middleware/requireAuth');

const PROFILE_FIELDS = [
  'first_name',
  'last_name',
  'country',
  'phone_number',
  'address_line1',
  'address_line2',
  'city',
  'province',
  'postal_code',
  'email_prefs',
];

function pickUpdates(body, allowed) {
  const updates = {};
  for (const key of allowed) {
    if (body[key] !== undefined) updates[key] = body[key];
  }
  return updates;
}

// Default-deny: every users route requires a valid session.
router.use(requireAuth);

// GET /users — admin only
router.get('/', requireAdmin, async (req, res) => {
  try {
    const users = await getAllUsers();
    res.json(users);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /users/me
router.get('/me', async (req, res) => {
  try {
    const user = await getUserByAuthId(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: error.message });
  }
});

// PATCH /users/me
router.patch('/me', async (req, res) => {
  try {
    const updates = pickUpdates(req.body || {}, PROFILE_FIELDS);
    const updatedUser = await updateUserByAuthId(req.user.id, updates);
    res.json(updatedUser);
  } catch (err) {
    console.error('Server error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /users/:auth_user_id — self or admin
router.get('/:auth_user_id', requireSelfOrAdmin('auth_user_id'), async (req, res) => {
  const authUserId = req.params.auth_user_id;

  try {
    const user = await getUserByAuthId(authUserId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: error.message });
  }
});

// PATCH /users/:auth_user_id — self or admin; only admins may set is_admin
router.patch('/:auth_user_id', requireSelfOrAdmin('auth_user_id'), async (req, res) => {
  const authUserId = req.params.auth_user_id;
  const allowedFields = [...PROFILE_FIELDS];
  await loadCallerUserRow(req);
  if (req.userRow?.is_admin) {
    allowedFields.push('is_admin');
  }

  const updates = pickUpdates(req.body || {}, allowedFields);

  try {
    const updatedUser = await updateUserByAuthId(authUserId, updates);
    res.json(updatedUser);
  } catch (err) {
    console.error('Server error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
