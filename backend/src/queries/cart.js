const supabase = require('../../supabase/db');

async function getCart(userId) {
  const { data, error } = await supabase
    .from('carts')
    .select('product_id, quantity, products (slug, description, price_cents, image_url)')
    .eq('user_id', userId);

  if (error) throw new Error(`Error fetching cart: ${error.message}`);

  return data.map(item => ({
    id: item.product_id,
    quantity: item.quantity,
    slug: item.products.slug,
    description: item.products.description,
    price_cents: item.products.price_cents,
    image_url: item.products.image_url
  }));
}

async function upsertCartItem(userId, productId, quantity) {
  const { error } = await supabase
    .from('carts')
    .upsert([{ user_id: userId, product_id: productId, quantity }], {
      onConflict: ['user_id', 'product_id']
    });

  if (error) throw new Error(`Error updating cart: ${error.message}`);
  return await getCart(userId);
}

async function deleteCartItem(userId, productId) {
  const { error } = await supabase
    .from('carts')
    .delete()
    .match({ user_id: userId, product_id: productId });

  if (error) throw new Error(`Error deleting cart item: ${error.message}`);
}

module.exports = {
  getCart,
  upsertCartItem,
  deleteCartItem
};
