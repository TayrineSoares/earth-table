const express = require('express');
const router = express.Router();
const { getAllUsers, getUserById } = require('../queries/user')

// GET /users          ALL USERS
router.get('/', async (req, res) => {
  try {
    const users = await getAllUsers();
    res.json(users);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /users/:id       SINGLE USER BY ID
router.get('/:id', async (req, res) => {
  const userId = req.params.id;

  try {
    const user = await getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;