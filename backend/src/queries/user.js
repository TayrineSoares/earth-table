const supabase = require('../../supabase/db')

async function getAllUsers() {
  const { data, error } = await supabase
    .from('users')
    .select('*');
    
  if (error) throw new Error(`Error fetching users: ${error.message}`);
  return data;
};

async function getUserByAuthId(authUserId) {
  if (!authUserId) {
    throw new Error("authUserId is required");
  }

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('auth_user_id', authUserId)
    .single();

  if (error) throw new Error(`Error fetching user by Auth Id: ${error.message}`);
  return data;
  
}

module.exports = {
  getAllUsers,
  getUserByAuthId,
};