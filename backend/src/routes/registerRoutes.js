const express = require('express');
const router = express.Router();
const supabase = require('../../supabase/db');
const { createClient } = require('@supabase/supabase-js');

const {
  SUPABASE_PROJECT_URL,
  SUPABASE_ANON_KEY,
} = process.env;


// POST /register
// registers a new user with Supabase Auth
router.post('/', async (req, res) => {
  const { email, password, first_name, last_name, phone_number } = req.body;

  // Call Supabase Auth to create a new user
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: 'http://localhost:5173/auth/callback',
      // store profile bits as user_metadata
      data: { first_name, last_name, phone_number }
    }
  });

  if (error) {
    return res.status(400).json({ error: error.message });
  }

    // No insert into "users" yet
  return res.status(202).json({
    ok: true,
    needs_confirmation: true,
    user: { id: data.user.id, email: data.user.email }
  });
});


// POST /register/confirmation
// after clicking on email and confirming registration, insert into users table 
router.post('/confirmation', async (req, res, next) => {
  try {
    
    // Require the user's access token
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Missing auth token' });

    // Create a client that acts AS THE USER (so RLS applies)
    const userClient = createClient(SUPABASE_PROJECT_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    // Read the authed user
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return res.status(401).json({ error: 'Invalid token' });

    // Pull profile fields (stored them during signUp in user_metadata)
    const { first_name, last_name, phone_number } = user.user_metadata || {};

    // Upsert into your users table (unique on auth_user_id)
    const { error: upsertErr } = await userClient
      .from('users')
      .upsert({
        auth_user_id: user.id,
        email: user.email,
        first_name,
        last_name,
        phone_number,
        is_admin: false,
      }, { onConflict: 'auth_user_id' });

    if (upsertErr) return res.status(400).json({ error: upsertErr.message });

    return res.json({ ok: true });
  } catch (e) {
    console.error('confirmation error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
});





module.exports = router;