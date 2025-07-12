const express = require('express');
const router = express.Router();
const supabase = require('../../supabase/db');

// POST /register
// registers a new user with Supabase Auth
router.post('/', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Call Supabase Auth to create a new user
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(201).json({
      user: data.user,
      session: data.session,
    });

  } catch (err) {
    console.error(err.message);
    return res.status(500).json({ error: 'Server error' });
  }
});


module.exports = router;