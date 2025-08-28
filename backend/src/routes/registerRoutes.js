const express = require('express');
const router = express.Router();
router.use((req, res, next) => {
  console.log('[register router]', req.method, req.originalUrl, 'body=', req.body);
  next();
});

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


  // 1) If Supabase explicitly returns an error
  if (error) {
    if (
      (error.status === 400 || error.status === 422 || error.status === 409) &&
      /already|exists/i.test(error.message || '')
    ) {
      return res.status(409).json({
        ok: false,
        already_registered: true,
        message: 'This email is already registered. Please log in.',
        redirect_to: '/login'
      });
    }
    return res.status(400).json({ ok: false, error: error.message });
  }

  // 2) Duplicate email (confirmed OR unconfirmed) => identities is empty
  //    Treat as "already registered" so the UI can show the Login prompt.
  const identities = data?.user?.identities;
  if (Array.isArray(identities) && identities.length === 0) {
    return res.status(409).json({
      ok: false,
      already_registered: true,
      message: 'This email is already registered. Please log in.',
      redirect_to: '/login'
    });
  }

  // 3) Normal happy path for a brand-new signup
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

// POST /auth/resend-confirmation  (backend)
router.post('/auth/resend-confirmation', async (req, res) => {
  const { email } = req.body;
  const { error } = await supabase.auth.resend({ type: 'signup', email });
  if (error) return res.status(400).json({ error: error.message });
  res.json({ ok: true });
});





module.exports = router;