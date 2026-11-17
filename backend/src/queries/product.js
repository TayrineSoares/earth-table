const supabase = require('../../supabase/db')

function assertValidPriceCents(price_cents) {
  const cents = Math.round(Number(price_cents));
  if (!Number.isFinite(cents) || cents <= 0) {
    const err = new Error('Price must be greater than $0.');
    err.status = 400;
    throw err;
  }
  return cents;
}

async function getAllProducts() {
  const { data: products, error } = await supabase
    .from('products')
    .select('*, product_tags(tag_id)')
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Error fetching products: ${error.message}`);

  return products.map(({ product_tags, ...product }) => ({
    ...product,
    tags: (product_tags || []).map((row) => row.tag_id),
  }));
}

async function getProductById(id) {
  const { data: product, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw new Error(`Error fetching product by id: ${error.message}`);
  
  const tagsNames = await getProductTags(id);
  return { ...product, tags:tagsNames };
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
  const validPrice = assertValidPriceCents(price_cents);

  const { data, error } = await supabase
    .from('products')
    .insert([
      { slug, description, price_cents: validPrice, image_url, category_id, is_available }
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

  if (Object.prototype.hasOwnProperty.call(productData, 'price_cents')) {
    productData.price_cents = assertValidPriceCents(productData.price_cents);
  }

  const { data, error } = await supabase
    .from('products')
    .update(productData)
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


async function updateProductTags(productId, tagIds) {

  const { error: deleteError } = await supabase
    .from('product_tags')
    .delete()
    .eq('product_id', productId);
  
  if (deleteError) throw new Error(`Error removing old tags: ${deleteError.message}`);

  if (tagIds.length === 0) return;

  const inserts = tagIds.map(tagId => ({
    product_id: productId,
    tag_id: tagId,
  }));

  const { error: insertError } = await supabase
    .from('product_tags')
    .insert(inserts);

  if (insertError) throw new Error(`Error inserting new tags: ${insertError.message}`);

}

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
    if (/0 rows/.test(error.message || '') || /Row not found/i.test(error.message || '')) {
      const e = new Error('Product not found');
      e.status = 404;
      throw e;
    }
    throw new Error(`Error updating product status: ${error.message}`);
  }
  return data;
}
  


/**
 * Resolve à la carte cart lines from the DB. Client may send id + quantity only;
 * price / slug / image come from products (never trust client price_cents).
 */
async function resolveCartItemsForCheckout(cartItems) {
  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    const err = new Error('Cart is empty.');
    err.status = 400;
    throw err;
  }

  const qtyById = new Map();
  for (const raw of cartItems) {
    const id = raw?.id ?? raw?.product_id;
    if (id == null || String(id).trim() === '') {
      const err = new Error('Each cart item needs a product id.');
      err.status = 400;
      throw err;
    }
    const qty = Math.floor(Number(raw.quantity));
    if (!Number.isFinite(qty) || qty < 1) {
      const err = new Error('Each cart item needs a quantity of at least 1.');
      err.status = 400;
      throw err;
    }
    const key = String(id);
    qtyById.set(key, (qtyById.get(key) || 0) + qty);
  }

  const ids = [...qtyById.keys()];
  const { data: products, error } = await supabase
    .from('products')
    .select('id, slug, price_cents, image_url, is_available')
    .in('id', ids);

  if (error) throw new Error(`Error loading products for checkout: ${error.message}`);

  const byId = new Map((products || []).map((p) => [String(p.id), p]));
  const resolved = [];

  for (const id of ids) {
    const product = byId.get(id);
    if (!product) {
      const err = new Error(`Product ${id} was not found.`);
      err.status = 400;
      throw err;
    }
    if (!product.is_available) {
      const err = new Error(`${product.slug || 'Item'} is no longer available.`);
      err.status = 400;
      throw err;
    }
    const price = Math.round(Number(product.price_cents) || 0);
    if (!Number.isFinite(price) || price <= 0) {
      const err = new Error(`${product.slug || 'Item'} has an invalid price.`);
      err.status = 400;
      throw err;
    }
    resolved.push({
      id: product.id,
      product_id: product.id,
      slug: product.slug,
      image_url: product.image_url || null,
      price_cents: price,
      quantity: qtyById.get(id),
    });
  }

  return resolved;
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
  resolveCartItemsForCheckout,
};