const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";

export const PICKUP_ADDRESS = "77 Woodstream Blvd, Vaughan, ON L4L 7Y7";
export const DELIVERY_WINDOW = "11:00 AM – 6:00 PM";

export const formatMoney = (cents) => `$${((Number(cents) || 0) / 100).toFixed(2)}`;

export const formatYmdLong = (ymd) => {
  if (!ymd) return "";
  const [y, m, d] = String(ymd).split("-").map(Number);
  if (!y || !m || !d) return "";
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

export const formatOrderPlacedAt = (isoString) => {
  if (!isoString) return "";
  const date = new Date(isoString);
  return (
    date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }) +
    " at " +
    date.toLocaleTimeString("en-US", { hour: "numeric", minute: "numeric" })
  );
};

export const shortOrderId = (id) =>
  String(id || "").replace(/-/g, "").slice(-8).toUpperCase();

export const parsePaymentInfo = (order) => {
  try {
    const raw = order?.buyer_stripe_payment_info;
    return typeof raw === "string" ? JSON.parse(raw) : raw || {};
  } catch {
    return {};
  }
};

export const getPostalFromBuyerInfo = (buyerStripeInfo) => {
  try {
    const parsed =
      typeof buyerStripeInfo === "string"
        ? JSON.parse(buyerStripeInfo)
        : buyerStripeInfo || {};
    return parsed?.delivery_meta?.postal_code || "";
  } catch {
    return "";
  }
};

export const getOrderDiscount = (order) => {
  const meta = parsePaymentInfo(order).discount_meta || {};
  const code = String(meta.code || order?.referral_code || "").trim();
  if (!code) return null;

  const kind = meta.kind || (order?.referral_code ? "referral" : "promo");
  const percent = Number(meta.percent);
  const itemSubtotalCents = Number(order?.item_subtotal_cents) || 0;
  let amountOffCents = Number(meta.amount_off_cents);
  if (!Number.isFinite(amountOffCents) || amountOffCents < 0) {
    const pct = Number.isFinite(percent) ? percent : kind === "referral" ? 15 : 0;
    amountOffCents = Math.round(itemSubtotalCents * pct / 100);
  }

  return {
    label: kind === "referral" ? "Referral" : "Promo",
    code: code.toUpperCase(),
    percent: Number.isFinite(percent) ? percent : kind === "referral" ? 15 : null,
    amountOffCents,
  };
};

export const getDeliveryFeeCents = (order) => {
  const preTax = Number(parsePaymentInfo(order)?.delivery_meta?.fee_cents_server) || 0;
  return preTax > 0 ? Math.round(preTax * 1.13) : 0;
};

export const isOrderItemAvailable = (item) =>
  Boolean(item?.product?.id) && item.product.is_available !== false;

export const toCartProduct = (item) => {
  const product = item?.product || {};
  return {
    id: product.id,
    slug: product.slug,
    price_cents: product.price_cents,
    image_url: product.image_url,
    quantity: Math.max(1, Number(item?.quantity) || 1),
  };
};

const fetchOrderBySessionId = async (sessionId) => {
  try {
    const res = await fetch(`${API_BASE}/api/orders/session/${sessionId}`);
    
    if (!res.ok) {
      throw new Error(`Failed to fetch order: ${res.status}`);
    }

    const data = await res.json();
    return data;
  } catch (err) {
    console.error('Error in fetchOrderBySessionId:', err);
    return null;
  }
};

const fetchOrdersByAuthId = async (authUserId) => {
  try {
    const res = await fetch(`/api/orders/user/${authUserId}`); 

    if(!res.ok) {
      throw new Error(`Failed to fetch orders: ${res.status}`);
    }
  
  const data = await res.json(); 
  return data;

  } catch (err) {
    console.error('Error in fetchOrdersByAuthId:', err);
    return [];

  }
};

const fetchAllOrders = async () => {
  try {
    const response = await fetch('/api/orders');
    if (!response.ok) {
      throw new Error(`Failed to fetch orders: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching all orders:", error.message);
    return [];
  }
}


const fetchOrderById = async (orderId) => {
  
  try {
    const response = await fetch(`/api/orders/${orderId}`);
    if (!response.ok) {
        throw new Error(`Failed to fetch order ${orderId}: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching order ${orderId}:`, error);
    throw error;
  }
}

const setOrderPickedUp = async (orderId, picked) => {

  const res = await fetch(`/api/orders/${orderId}/picked-up`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ picked_up: !!picked }),
    credentials: 'include',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update picked_up');
  }
  return res.json();

}


export { 
  fetchOrderBySessionId,
  fetchOrdersByAuthId, 
  fetchAllOrders, 
  fetchOrderById,
  setOrderPickedUp,
 
}; 