const express = require('express');
const router = express.Router();
const supabase = require('../../supabase/db');

const { FRONTEND_URL } = process.env;

// POST /login

// Helper: pick redirect base (env > Origin header > localhost)
function getRedirectBase(req) {
  return (FRONTEND_URL || req.headers.origin || 'http://localhost:5173').replace(/\/+$/, '');
}


router.post('/', async (req, res) => {
  const { email, password } = req.body;

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return res.status(401).json({error: error.message});
    }

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

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Valid email is required' });
  }
  const redirectTo = `${getRedirectBase(req)}/update-password`;
  console.log(`[reset-password] env=${process.env.NODE_ENV || 'dev'} redirectTo = ${redirectTo}`);
    

  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

  if (error) {
    console.error('Reset email error:', error.message);
    return res.status(400).json({ error: error.message });

  }

  return res.status(200).json({ message: 'Reset email sent' });
})



module.exports = router;
