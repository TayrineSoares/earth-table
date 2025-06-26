const supabase = require('../../supabase/db')

async function getAllUsers() {
  const { data, error } = await supabase
    .from('users')
    .select('*');
    
  if (error) throw new Error(`Error fetching users: ${error.message}`);
  return data;
};

async function getUserById(id) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw new Error(`Error fetching user by id: ${error.message}`);
  return data;
};


module.exports = {
  getAllUsers,
  getUserById,
};