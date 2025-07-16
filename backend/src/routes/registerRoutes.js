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

//POST /register/profile
router.post('/profile', async (req, res) => {
  const { id, first_name, last_name, country, phone_number } = req.body;

  try {
     // Update the user's profile fields in the 'users' table
    const { data, error } = await supabase
      .from('users')
      .update({
        first_name,
        last_name,
        country,
        phone_number
      })
      .eq('id', id)  // only update the row where id matches the user’s id
      .select();  // returns updated rows
      
      if (error) {
      return res.status(500).json({ error: error.message });
      }

    console.log(data[0]);
    return res.status(200).json({ user: data[0]});

  } catch (err) {
      console.error('Profile update error:', err.message);
      return res.status(500).json({ error: 'Server error during profile update'});
  } 

});


module.exports = router;