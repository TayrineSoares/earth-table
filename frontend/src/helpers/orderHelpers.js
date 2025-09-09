const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";

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