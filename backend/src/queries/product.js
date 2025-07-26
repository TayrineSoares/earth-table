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

async function createProduct({ slug, description, price_cents, image_url, category_id, tag_ids = [] }) {

  console.log("→ In createProduct");
  console.log("Received tag_ids:", tag_ids);

  const { data, error } = await supabase
    .from('products')
    .insert([
      { slug, description, price_cents, image_url, category_id }
    ])
    .select();

  if (error) throw new Error(`Error creating product: ${error.message}`);
  const product =  data[0]; 
  console.log("Product created:", product);

  if (tag_ids.length > 0) {
    console.log("→ Calling updateProductTags");
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
  console.log("→ In updateProductTags");
  console.log("Product ID:", productId);
  console.log("Tag IDs:", tagIds);

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

  console.log("Inserting:", inserts);

  const { error: insertError } = await supabase
    .from('product_tags')
    .insert(inserts);

  if (insertError) throw new Error(`Error inserting new tags: ${insertError.message}`);
  console.log("Tags inserted successfully");
}

// Get all tag IDs associated with a specific product
async function getProductTagIds(productId) {
  const { data, error } = await supabase
    .from('product_tags')
    .select('tag_id')
    .eq('product_id', productId);

  if (error) throw new Error(`Error fetching product tags: ${error.message}`);
  return data.map(row => row.tag_id);
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
  getProductTagIds,
};