const supabase = require('../../supabase/db')

async function getAllCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('*');

  if (error) throw new Error(`Error fetching categories: ${error.message}`);
  return data;
};

module.exports = {
  getAllCategories,
};