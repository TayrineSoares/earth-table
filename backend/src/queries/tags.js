const supabase = require('../../supabase/db')

async function getAllTags() {
  const { data, error } = await supabase 
    .from ('tags')
    .select('*');

  if (error) throw new Error(`Error fetching users: ${error.message}`);
  return data;
};

module.exports = {
  getAllTags
};