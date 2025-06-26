const supabase = require('../../supabase/db')

async function getAllProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('*');

  if (error) throw new Error(`Error fetching products: ${error.message}`);
  return data;
};

async function getProductById(id) {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw new Error(`Error fetching product by id: ${error.message}`);
  return data;
};

async function getProductsByCategory(categoryId) {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('category_id', categoryId);

  if (error) throw new Error(`Error fetching prodcuts by categoryId: ${error.message}`);
  return data;
};

module.exports = {
  getAllProducts,
  getProductById,
  getProductsByCategory
};