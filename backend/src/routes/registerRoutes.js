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

     // Insert blank record into users table
    const { error: insertError } = await supabase
      .from('users')
      .insert({
        auth_user_id: data.user.id,
        email: data.user.email,
        first_name: "",
        last_name: "",
        country: "",
        phone_number: "",
        is_admin: false 
      });

    if (insertError) {
      console.error('Error inserting user record:', insertError.message);
      return res.status(500).json({ error: 'Failed to create user record' });
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
  const { auth_user_id, first_name, last_name, country, phone_number } = req.body;

  try {
     // Update the user's profile fields in the 'users' table
    const { data, error } = await supabase
      .from('users')
      .update({
        first_name,
        last_name,
        phone_number,
        country,
    
      })
      .eq('auth_user_id', auth_user_id) 
      .select();  // returns updated rows

      //console.log("Supabase update returned data:", data);
      //console.log("Supabase update returned error:", error);
      
      if (error) {
      console.error(error);
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