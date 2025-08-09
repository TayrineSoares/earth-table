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
    .select(`
      id,
      status,
      total_cents,
      created_at,
      buyer_email,
      order_products (
        product_id,
        quantity,
        unit_price_cents,
        product:products (        
          slug,
          image_url
        )
      )
    `)
    .eq('id', orderId)
    .single();

  if (error) throw new Error(`Error fetching order by id: ${error.message}`);
  return data;
}

async function getOrderByUserId(userId) {
  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      order_products (
        quantity,
        unit_price_cents,
        product:products (
          slug
        )
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Error fetching order by userId: ${error.message}`);
  return data;
}

async function createOrderWithProducts({ 
  user_id = null,
  buyer_email,
  buyer_name,
  buyer_phone_number,
  buyer_address,
  buyer_stripe_payment_info,
  status = 'pending', // default status if not provided
  stripe_session_id,
  total_cents,
  products = [],
  
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
      buyer_name,
      buyer_phone_number,
      buyer_address,
      buyer_stripe_payment_info,
      status, 
      stripe_session_id, 
      total_cents
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

const getOrderByStripeSessionId = async (sessionId) => {
  // fetch the order matching the session_id from buyer_stripe_payment_info
  const { data: order, error } = await supabase
    .from('orders')
    .select('*')
    .eq('stripe_session_id', sessionId)
    .maybeSingle();

  if (error) {
    throw new Error(`Error fetching order: ${error.message}`);
  }

  if (!order) return null;

  const { data: orderProducts, error: orderProductsError } = await supabase
  .from('order_products')
  .select (`
    quantity,
    unit_price_cents,
    product:products (
      slug,
      image_url
    )
  `)
  .eq('order_id', order.id);

    if (orderProductsError) {
      throw new Error(`Error fetching order products: ${orderProductsError.message}`);
    }


  // Format the result to send to frontend
  return {
    id: order.id,
    status: order.status,
    buyer_email: order.buyer_email || null,
    buyer_name: order.buyer_name || null,
    created_at: order.created_at,
    total_cents: order.total_cents,
    products: orderProducts.map(op => ({
      slug: op.product?.slug || 'Unnamed Product',
      image_url: op.product?.image_url || '',
      quantity: op.quantity,
      unit_price_cents: op.unit_price_cents
    }))
    
  };
};


module.exports = {
  getAllOrders,
  getOrderById,
  getOrderByUserId,
  createOrderWithProducts, 
  getOrderByStripeSessionId
};