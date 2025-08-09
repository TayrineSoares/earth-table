

const fetchOrderBySessionId = async (sessionId) => {
  try {
    const res = await fetch(`http://localhost:8080/orders/session/${sessionId}`);
    
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
    const res = await fetch(`http://localhost:8080/orders/user/${authUserId}`); 

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
    const response = await fetch('http://localhost:8080/orders');
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
    const response = await fetch(`http://localhost:8080/orders/${orderId}`);
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




export { 
  fetchOrderBySessionId,
  fetchOrdersByAuthId, 
  fetchAllOrders, 
  fetchOrderById
 
}; 