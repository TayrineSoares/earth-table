const express = require('express');
const router = express.Router();
const { getAllUsers, getUserByAuthId, updateUserByAuthId } = require('../queries/user')


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

// GET /users/:auth_user_id    SINGLE USER BY AUTH ID
router.get('/:auth_user_id', async (req,res) => {
  const authUserId = req.params.auth_user_id;

  try {
    const user = await getUserByAuthId(authUserId);
    if (!user) {
      return res.status(404).json({ error: 'User not found'} );
    }
    res.json(user);

  } catch (error) {
    console.error(error.message);
    res.status(500).json({error: error.message})
  }

});


//PATCH /users/:auth_user_id 
router.patch('/:auth_user_id', async (req, res) => {
  const authUserId = req.params.auth_user_id;
  const allowedFields = ['first_name', 'last_name', 'country', 'phone_number'];
  const updates = {};

  // Only keep fields that are allowed and present in the request
  for (const key of allowedFields) {
    if (req.body[key] !== undefined) {
      updates[key] = req.body[key];
    }
  }

  try {
    const updatedUser = await updateUserByAuthId(authUserId, updates);
    res.json(updatedUser);
      } catch (err) {
        console.error("Server error:", err.message);
        res.status(500).json({ error: err.message });
  }
});


module.exports = router;