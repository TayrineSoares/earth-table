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

    //insert record into users table
    const { data: insertData, error: insertError } = await supabase
      .from ('users')
      .insert({
        auth_user_id: data.user.id, 
        email: data.user.email,
        first_name: "",
        last_name: "",
        phone_number: "",
        address_line1: "",
        address_line2: "",
        city: "", 
        province: "",
        postal_code: "",
        country: "",
        
        is_admin: false,
      })
      .select();
      

    if (insertError) {
      console.error("Error inserting user record", insertError.message);
      return res.status(500).json({error: 'Failed to create user record'});
    } 
      
    console.log("User Record:", insertData);
      
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