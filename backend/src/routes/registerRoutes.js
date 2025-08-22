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

  
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: 'http://localhost:5173/auth/callback',
      data: { first_name, last_name, phone_number }
    }
  });

  if (error) {
    return res.status(400).json({ error: error.message });
  }

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
    
    
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Missing auth token' });

    const userClient = createClient(SUPABASE_PROJECT_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return res.status(401).json({ error: 'Invalid token' });

    const { first_name, last_name, phone_number } = user.user_metadata || {};

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