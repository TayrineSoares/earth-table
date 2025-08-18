const supabase = require('../../supabase/db')

// HELPER format date to use inside other functions to display later on front end
const formatDisplayDate = (ymd) => {
  if (!ymd) return null;
  const [y, m, d] = ymd.split("-");
  const dt = new Date(y, m - 1, d); // local time
  return dt.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

async function getAllOrders() {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false });

  if (error) throw new Error(`Error fetching orders: ${error.message}`);
  return data || [];
}

async function getOrderById(orderId) {
  const { data: order, error } = await supabase
    .from('orders')
    .select(`
      id,
      status,
      total_cents,
      created_at,
      buyer_email,
      buyer_phone_number,
      user_id,
      pickup_date,
      pickup_time_slot,
      delivery,
      special_note,
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

  let user = null;
  if (order?.user_id) {
    const { data:userData, error:userError } = await supabase
    .from('users')
    .select('auth_user_id, email, first_name, last_name, phone_number')
    .eq('auth_user_id', order.user_id)
    .single();

    if (!userError) user = userData;
  }
  return {...order, user };
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

  return data || [];
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
  pickup_date,
  pickup_time_slot,
  delivery,
  special_note
  
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
      total_cents, 
      pickup_date,
      pickup_time_slot,
      delivery,
      special_note,
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
    pickup_date: order.pickup_date || null,
    pickup_date_formatted: formatDisplayDate(order.pickup_date),
    pickup_time_slot: order.pickup_time_slot || null,
    delivery: order.delievery || false,
    special_note: order.special_note || null,
    products: orderProducts.map(op => ({
      slug: op.product?.slug || 'Unnamed Product',
      image_url: op.product?.image_url || '',
      quantity: op.quantity,
      unit_price_cents: op.unit_price_cents
    }))
    
  };
};

const setOrderPickedUp = async (orderId, pickedUp) => {
  const { data, error } = await supabase
    .from('orders')
    .update({ picked_up: !!pickedUp })
    .eq('id', orderId)
    .select('*')
    .single();

  if (error) throw new Error(`Error updating picked_up: ${error.message}`);
  return data;
}


module.exports = {
  getAllOrders,
  getOrderById,
  getOrderByUserId,
  createOrderWithProducts, 
  getOrderByStripeSessionId, 
  setOrderPickedUp
};