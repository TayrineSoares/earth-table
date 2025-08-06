import { useEffect } from 'react';
import { fetchAllOrders } from '../helpers/orderHelpers';

const OrderAdmin = () => {

  useEffect(() => {
    const loadOrders = async () => {
      const data = await fetchAllOrders();
      console.log("All orders:", data); 
    };

    loadOrders();
  }, []);


  return (
    <div>
      <h1>Order Admin tab </h1>
      
    </div>
  )
};

export default OrderAdmin;
