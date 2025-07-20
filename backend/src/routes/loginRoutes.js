const express = require('express');
const router = express.Router();
const supabase = require('../../supabase/db');

const { getAllUsers, getUserById } = require('../queries/user')

// Supabase Auth handles login and returns you the user’s id and info if the email + password are correct.
// POST /login

router.post('/', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Attempt to sign in the user using Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    // If there was an error signing in (e.g. invalid email/password), return 401 Unauthorized
    if (error) {
      return res.status(401).json({error: error.message});
    }

    // Extract the logged-in user's unique Supabase ID
    return res.status(200).json({
      user:data.user,
      session:data.session,
    }); 

  } catch (err) {
    console.error(err.message); 
    return res.status(500).json({error: "Server error"})
  }
}); 


//POST /reset-password
router.post('/reset-password', async (req, res) => {
  const { email } = req.body; 

  const { error } = await supabase.auth.admin.resetPasswordForEmail(email, {
    redirectTo: 'http://localhost:5173/update-password'
  });

  if (error) {
    console.error('Reset email error:', error.message);
    return res.status(400).json({ error: error.message });

  }

  return res.status(200).json({ message: 'Reset email sent' });
})



module.exports = router;
