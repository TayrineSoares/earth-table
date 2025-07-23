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

async function createProduct({ slug, description, price_cents, image_url, category_id }) {
  const { data, error } = await supabase
    .from('products')
    .insert([
      { slug, description, price_cents, image_url, category_id }
    ])
    .select();

  if (error) throw new Error(`Error creating product: ${error.message}`);
  return data[0]; // return the created product
}




module.exports = {
  getAllProducts,
  getProductById,
  getProductsByCategory, 
  createProduct
};