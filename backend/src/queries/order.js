const supabase = require('../../supabase/db')

async function getAllOrders() {
  const { data, error } = await supabase
    .from('orders')
    .select('*');

  if (error) throw new Error(`Error fetching orders: ${error.message}`);
  return data;
}

async function getOrderById(orderId) {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single();

  if (error) throw new Error(`Error fetching order by id: ${error.message}`);
  return data;
}

async function getOrderByUserId(userId) {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
    
  if (error) throw new Error(`Error fetching order by userId: ${error.message}`);
  return data;
}

async function createOrderWithProducts({ 
  user_id = null,
  buyer_email,
  buyer_last_name,
  buyer_phone_number,
  buyer_address,
  buyer_stripe_payment_info,
  status = 'pending', // default status if not provided
  products = []
}) {

  if (products.length === 0) {
    throw new Error("No products provided for the order.");
  }
  // insert order into orders table
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert([{
      user_id,
      buyer_email,
      buyer_last_name,
      buyer_phone_number,
      buyer_address,
      buyer_stripe_payment_info,
      status
    }])
    .select()
    .single();

  if (orderError) throw new Error(`Error creating order: ${orderError.message}`);
  
  // create array of records to insert into orders_products table
  const orderProducts = products.map(product => ({
    order_id: order.id,
    product_id: product.id,
    quantity: product.quantity,
    unit_price_cents: product.price_cents
  }));

  // insert all the products entries into the orders_products table
  const { error: orderProductsError } = await supabase
    .from('order_products')
    .insert(orderProducts);

  if (orderProductsError) throw new Error(`Error inserting order products: ${orderProductsError.message}`);

  return order;
}


module.exports = {
  getAllOrders,
  getOrderById,
  getOrderByUserId,
  createOrderWithProducts
};