const supabase = require('../supabase/db');

async function signupJane() {
  const { data, error } = await supabase.auth.signUp({
    email: 'jane@test.com',
    password: 'hashed_pw',
  });

  if (error) {
    console.error('Signup error:', error.message);
  } else {
    console.log('Signup successful:', data.user);
  }
}

signupJane();