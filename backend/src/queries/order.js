const supabase = require('../../supabase/db')

const USER_FIELDS = 'auth_user_id, email, first_name, last_name, phone_number';

const formatDisplayDate = (ymd) => {
  if (!ymd) return null;
  const [y, m, d] = ymd.split("-");
  const dt = new Date(y, m - 1, d); 
  return dt.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

const parsePaymentInfo = (raw) => {
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : (raw || {});
  } catch {
    return {};
  }
};

const asCartMeta = (products) =>
  (products || [])
    .map((p) => ({
      id: p.id || p.product_id || null,
      slug: p.slug || p.product?.slug || 'Item',
      quantity: Number(p.quantity) || 0,
      price_cents: Number(p.price_cents) || Number(p.unit_price_cents) || 0,
      image_url: p.image_url || p.product?.image_url || '',
    }))
    .filter((p) => p.quantity > 0);

const paymentInfoWithCartMeta = (raw, products) => {
  const info = parsePaymentInfo(raw);
  const meta = asCartMeta(products);
  if (meta.length) info.cart_meta = meta;
  return JSON.stringify(info);
};

const itemsFromCartMeta = (info) => {
  const meta = info?.cart_meta;
  if (!Array.isArray(meta) || !meta.length) return [];
  return meta.map((item, idx) => ({
    id: item.id != null ? `meta-${item.id}-${idx}` : `meta-${idx}`,
    product_id: item.id || item.product_id || null,
    quantity: Number(item.quantity) || 0,
    unit_price_cents: Number(item.price_cents) || Number(item.unit_price_cents) || 0,
    product: {
      slug: item.slug || 'Item',
      image_url: item.image_url || '',
    },
  }));
};

const stripTaxSuffix = (name) =>
  String(name || 'Item').replace(/\s*\(includes tax\)\s*$/i, '').trim() || 'Item';

async function itemsFromStripeSession(sessionId) {
  const id = String(sessionId || '');
  if (!/^cs_(live|test)_/.test(id)) return [];
  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_SK);
    const listed = await stripe.checkout.sessions.listLineItems(id, { limit: 100 });
    return (listed.data || [])
      .filter((li) => !/delivery fee/i.test(li.description || ''))
      .map((li, idx) => ({
        id: li.id || `stripe-${idx}`,
        product_id: null,
        quantity: Number(li.quantity) || 1,
        unit_price_cents: Number(li.price?.unit_amount) || 0,
        product: {
          slug: stripTaxSuffix(li.description),
          image_url: '',
        },
      }));
  } catch (err) {
    console.warn('[orders] stripe line items unavailable:', err.message);
    return [];
  }
}

async function findBuyerUser(order) {
  if (order?.user_id) {
    const { data, error } = await supabase
      .from('users')
      .select(USER_FIELDS)
      .eq('auth_user_id', order.user_id)
      .maybeSingle();
    if (!error && data) return data;
  }

  const email = String(order?.buyer_email || '').trim();
  if (!email) return null;

  const { data, error } = await supabase
    .from('users')
    .select(USER_FIELDS)
    .ilike('email', email)
    .limit(1);
  if (error) return null;
  return (data && data[0]) || null;
}

async function resolveOrderItems(order, embeddedProducts) {
  let items = Array.isArray(embeddedProducts)
    ? embeddedProducts.filter((row) => row && (Number(row.quantity) > 0 || row.product))
    : [];

  if (!items.length && order?.id) {
    const { data, error } = await supabase
      .from('order_products')
      .select(`
        id,
        product_id,
        quantity,
        unit_price_cents,
        product:products (
          id,
          slug,
          image_url
        )
      `)
      .eq('order_id', order.id);
    if (!error) items = data || [];
  }

  if (!items.length) {
    items = itemsFromCartMeta(parsePaymentInfo(order?.buyer_stripe_payment_info));
  }

  if (!items.length) {
    items = await itemsFromStripeSession(order?.stripe_session_id);
  }

  return items;
}

async function attachBuyerAndItems(order, embeddedProducts) {
  if (!order) return order;
  const [user, order_products] = await Promise.all([
    findBuyerUser(order),
    resolveOrderItems(order, embeddedProducts),
  ]);
  return { ...order, user, order_products };
}

async function catalogMatches(products) {
  const ids = [...new Set(products.map((p) => p.id || p.product_id).filter((id) => id != null))];
  const slugs = [...new Set(products.map((p) => p.slug).filter(Boolean))];
  const [{ data: byId }, { data: bySlug }] = await Promise.all([
    ids.length
      ? supabase.from('products').select('id, slug, image_url').in('id', ids)
      : Promise.resolve({ data: [] }),
    slugs.length
      ? supabase.from('products').select('id, slug, image_url').in('slug', slugs)
      : Promise.resolve({ data: [] }),
  ]);
  return {
    idMap: new Map((byId || []).map((p) => [p.id, p])),
    slugMap: new Map((bySlug || []).map((p) => [String(p.slug).toLowerCase(), p])),
  };
}

async function getAllOrders() {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .is('subscription_cycle_id', null)
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
      buyer_name,
      buyer_phone_number,
      buyer_stripe_payment_info,
      user_id,
      stripe_session_id,
      pickup_date,
      pickup_time_slot,
      delivery,
      delivery_date,
      special_note,
      order_products (
        id,
        product_id,
        quantity,
        unit_price_cents,
        product:products (
          id,
          slug,
          image_url
        )
      )
    `)
    .eq('id', orderId)
    .single();

  if (error) throw new Error(`Error fetching order by id: ${error.message}`);
  return attachBuyerAndItems(order, order?.order_products);
}

async function getOrderByUserId(userId) {
  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      order_products (
        product_id,
        quantity,
        unit_price_cents,
        product:products (
          id,
          slug,
          image_url,
          price_cents,
          is_available
        )
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Error fetching order by userId: ${error.message}`);

  return Promise.all(
    (data || []).map((order) => attachBuyerAndItems(order, order.order_products))
  );
}

async function createOrderWithProducts({ 
  
  user_id = null,
  buyer_email,
  buyer_name,
  buyer_phone_number,
  buyer_address,
  buyer_stripe_payment_info,
  status = 'pending',
  stripe_session_id,
  total_cents,
  products = [],
  pickup_date,
  pickup_time_slot,
  delivery,
  delivery_date, 
  special_note,
  referral_partner_id = null,
  referral_code = null,
  credit_applied_cents = 0,
  item_subtotal_cents = null,
  subscription_cycle_id = null,
  
}) {

  if (products.length === 0) {
    throw new Error("No products provided for the order.");
  }

  const { idMap, slugMap } = await catalogMatches(products);
  const productsWithNames = products.map((p) => {
    const match = idMap.get(p.id || p.product_id)
      || slugMap.get(String(p.slug || '').toLowerCase());
    return {
      ...p,
      slug: p.slug || match?.slug,
      image_url: p.image_url || match?.image_url,
    };
  });

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert([{
      user_id,
      buyer_email,
      buyer_name,
      buyer_phone_number,
      buyer_address,
      buyer_stripe_payment_info: paymentInfoWithCartMeta(
        buyer_stripe_payment_info,
        productsWithNames
      ),
      status, 
      stripe_session_id, 
      total_cents, 
      pickup_date,
      pickup_time_slot,
      delivery,
      delivery_date,
      special_note,
      referral_partner_id: referral_partner_id || null,
      referral_code: referral_code || null,
      credit_applied_cents: Number(credit_applied_cents) || 0,
      item_subtotal_cents: item_subtotal_cents == null ? null : Number(item_subtotal_cents),
      subscription_cycle_id: subscription_cycle_id || null,
    }])
    .select()
    .single();

  if (orderError) throw new Error(`Error creating order: ${orderError.message}`);

  const orderProducts = products.map((product) => {
    const match = idMap.get(product.id || product.product_id)
      || slugMap.get(String(product.slug || '').toLowerCase());
    if (!match) return null;
    return {
      order_id: order.id,
      product_id: match.id,
      quantity: product.quantity,
      unit_price_cents: Number(product.price_cents) || Number(product.unit_price_cents) || 0,
    };
  }).filter(Boolean);

  if (orderProducts.length) {
    const { error: orderProductsError } = await supabase
      .from('order_products')
      .insert(orderProducts);
    if (orderProductsError) {
      console.error(
        '[createOrderWithProducts] order_products insert failed:',
        orderProductsError.message
      );
    }
  } else {
    console.warn(
      '[createOrderWithProducts] no catalog matches; cart_meta saved on order',
      order.id
    );
  }

  return order;
}

const toBool = (v) =>
  v === true || v === 'true' || v === 1 || v === '1' || v === 't' || v === 'T';

const getOrderByStripeSessionId = async (sessionId) => {
  const { data: order, error } = await supabase
    .from('orders')
    .select('*')
    .eq('stripe_session_id', sessionId)
    .maybeSingle();

  if (error) throw new Error(`Error fetching order: ${error.message}`);
  if (!order) return null;

  // console.log('[getOrderBySession] RAW row.delivery:', order.delivery, 'type:', typeof order.delivery, 'sessionId:', sessionId);

  const detailed = await attachBuyerAndItems(order, null);
  const deliveryBool = toBool(order.delivery);

  return {
    id: order.id,
    status: order.status,
    buyer_email: order.buyer_email || null,
    buyer_name: order.buyer_name || null,
    buyer_phone_number: order.buyer_phone_number || null,
    created_at: order.created_at,
    total_cents: order.total_cents,
    buyer_stripe_payment_info: order.buyer_stripe_payment_info || null,
    pickup_date: order.pickup_date || null,
    pickup_date_formatted: formatDisplayDate(order.pickup_date),
    pickup_time_slot: order.pickup_time_slot || null,
    delivery: deliveryBool,
    delivery_date: order.delivery_date || null,
    delivery_date_formatted: formatDisplayDate(order.delivery_date),
    special_note: order.special_note || null,
    referral_code: order.referral_code || null,
    referral_partner_id: order.referral_partner_id || null,
    credit_applied_cents: Number(order.credit_applied_cents) || 0,
    item_subtotal_cents: order.item_subtotal_cents == null
      ? null
      : Number(order.item_subtotal_cents),
    user: detailed.user || null,
    products: (detailed.order_products || []).map((op) => ({
      slug: op.product?.slug || 'Unnamed Product',
      image_url: op.product?.image_url || '',
      quantity: op.quantity,
      unit_price_cents: op.unit_price_cents
    })),
    order_products: detailed.order_products || [],
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