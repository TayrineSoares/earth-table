

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



export { 
  fetchOrderBySessionId,
  fetchOrdersByAuthId 
 
}; 