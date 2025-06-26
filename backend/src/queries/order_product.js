const supabase = require('../../supabase/db')

async function getProductsForOrder(orderId) {
  const { data, error } = await supabase
    .from('order_products')
    .select('*')
    .eq('order_id', orderId);

  if (error) throw new Error(`Error fetching order_products by orderId: ${error.message}`);
  return data;
};

module.exports = {
  getProductsForOrder
};