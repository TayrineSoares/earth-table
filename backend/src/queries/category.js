const supabase = require('../../supabase/db')

async function getAllCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('*');

  if (error) throw new Error(`Error fetching categories: ${error.message}`);
  return data;
};

async function getHomepageCategories() {
  const {data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('show_on_homepage', true);
  
  if (error) throw new Error(`Error fetching homepage categories: ${error.message}`);
  return data;
}

module.exports = {
  getAllCategories,
  getHomepageCategories
};

