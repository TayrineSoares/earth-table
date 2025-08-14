const supabase = require('../../supabase/db')

async function getAllProducts() {
  const { data: products, error } = await supabase
    .from('products')
    .select('*');

  if (error) throw new Error(`Error fetching products: ${error.message}`);

  // Fetch tags for each product
  const productsWithTags = await Promise.all(products.map(async (product) => {
    const tagsNames = await getProductTags(product.id);
    return { ...product, tags: tagsNames };
  }));

  return productsWithTags;
}

async function getProductById(id) {
  const { data: product, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw new Error(`Error fetching product by id: ${error.message}`);
  
  const tagsNames = await getProductTags(id); // fetch tags names
  return { ...product, tags:tagsNames }; // include them in the response
};

async function getProductsByCategory(categoryId) {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('category_id', categoryId);

  if (error) throw new Error(`Error fetching prodcuts by categoryId: ${error.message}`);
  return data;
};

async function createProduct({ slug, description, price_cents, image_url, category_id, is_available, tag_ids = [] }) {

  const { data, error } = await supabase
    .from('products')
    .insert([
      { slug, description, price_cents, image_url, category_id, is_available }
    ])
    .select();

  if (error) throw new Error(`Error creating product: ${error.message}`);
  const product =  data[0]; 


  if (tag_ids.length > 0) {
    await updateProductTags(product.id, tag_ids)
  }

  return product;
}

async function deleteProductById(id) {
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id);

  if (error) throw new Error(`Error deleting product: ${error.message}`);
}

async function updateProductById(id, updatedData) {
  const { tag_ids = [], ...productData } = updatedData;

  console.log("Updating product:", { id, productData, tag_ids });

  const { data, error } = await supabase
    .from('products')
    .update(updatedData)
    .eq('id', id)
    .select() 
    .single();

  if (error) throw new Error(`Error updating product: ${error.message}`);

  await updateProductTags(id, tag_ids);

  return data;
}

async function uploadProductImage(fileBuffer, fileName, mimeType) {
  const filePath = `product-${Date.now()}-${fileName}`;

  const { error } = await supabase.storage
    .from('products-images')
    .upload(filePath, fileBuffer, {
      contentType: mimeType,
    });

  if (error) throw new Error(`Error uploading image: ${error.message}`);

  const { data: publicUrlData } = supabase.storage
    .from('products-images')
    .getPublicUrl(filePath);

  return publicUrlData.publicUrl;
}

// link products to tags 
async function updateProductTags(productId, tagIds) {

  //delete existing tags if any
  const { error: deleteError } = await supabase
    .from('product_tags')
    .delete()
    .eq('product_id', productId);
  
  if (deleteError) throw new Error(`Error removing old tags: ${deleteError.message}`);

  if (tagIds.length === 0) return; // skip insert if no tags selected

  // Insert new product-tag pairs
  const inserts = tagIds.map(tagId => ({
    product_id: productId,
    tag_id: tagId,
  }));


  const { error: insertError } = await supabase
    .from('product_tags')
    .insert(inserts);

  if (insertError) throw new Error(`Error inserting new tags: ${insertError.message}`);

}

// Get all tag IDs associated with a specific product
async function getProductTags(productId) {
  const { data, error } = await supabase
    .from('product_tags')
    .select('tag_id')
    .eq('product_id', productId);

  if (error) throw new Error(`Error fetching product tags: ${error.message}`);
  return data.map(row => row.tag_id);
}

async function setProductActive(id, isActive) {
  const { data, error } = await supabase
    .from('products')
    .update({ is_active: !!isActive })
    .eq('id', id)
    .select('id,slug,is_active')
    .single();

  if (error) {
    // Supabase returns 406/single error when no row matches
    if (/0 rows/.test(error.message || '') || /Row not found/i.test(error.message || '')) {
      const e = new Error('Product not found');
      e.status = 404;
      throw e;
    }
    throw new Error(`Error updating product status: ${error.message}`);
  }
  return data;
}
  


module.exports = {
  getAllProducts,
  getProductById,
  getProductsByCategory, 
  createProduct, 
  deleteProductById,
  updateProductById,
  uploadProductImage,
  updateProductTags,
  getProductTags,
  setProductActive,
};