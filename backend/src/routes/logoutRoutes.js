const express = require('express');
const router = express.Router();
const supabase = require('../../supabase/db');

// POST /logout
router.post('/', async (req, res) => {
  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      return res.status(500).json({error: error.message});
    }
    return res.status(200).json({message: 'Logged out successfully'});
  } catch (err) {
    console.error('Logout error:', err.message);
    return res.status(500).json({ error: 'Server error during logout.' });
  }
});

module.exports = router;