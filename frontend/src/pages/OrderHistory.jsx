import React, { useEffect, useState } from "react";
import { fetchOrdersByAuthId } from "../helpers/orderHelpers";
import '../styles/OrderHistory.css'
import loadingAnimation from '../assets/loading.json'
import Lottie from 'lottie-react';
import checkoutImage from "../assets/images/checkoutImage.png"


const OrderHistory = ({user}) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
 
  const formattedPickupDate = (pickupDate) => {
    if (!pickupDate) return "";

    const [year, month, day] = pickupDate.split("-");
    const localDate = new Date(year, month - 1, day); 
    return localDate.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const formattedOrderDate = (isoString) => {
    if (!isoString) return "";
    const date = new Date(isoString);
    return date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric"
    }) + " at " + date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "numeric"
    });
  };

  useEffect(() => {
    if (!user?.id) return; 

    const loadOrders = async () => {
      const data = await fetchOrdersByAuthId(user.id); 
      setOrders(data);
      setLoading(false);

    }; 

    loadOrders(); 
  }, [user]); 


  if (loading) {
    return (
      <div className="loading-container">
        <Lottie animationData={loadingAnimation} loop={true} />
      </div>
    );
  }
  if (!orders.length) return <p>No orders found.</p>;
  
  return (
    <div>
      <div className='checkout-page-header-image'>
        <img 
          src={checkoutImage}
          className='checkout-image'
        />
      </div>

      <div className="page-wrapper">

        <h2 className="password-text">Your Order History</h2>
        <br/>
        {orders.map((order) => (
          <div key={order.id} className="order-card">
            <p><strong>Order ID:</strong> {order.id}</p>
            <p><strong>Status:</strong> {order.status}</p>
            <p><strong>Date:</strong> {formattedOrderDate(order.created_at)}</p>
            <p>Pickup on:</p> 
            <p> {formattedPickupDate(order.pickup_date)}, at {order.pickup_time_slot} </p>
            <p><strong>Total:</strong> ${(order.total_cents / 100).toFixed(2)}</p>
                      

            {order.order_products?.length > 0 && (
              <>
                <p><strong>Items:</strong></p>
                <ul className="order-products">
                  {order.order_products.map((item, idx) => (
                    <li key={idx}>
                      {item.quantity}x {item.product?.slug || "Unnamed product"} - ${(item.unit_price_cents / 100).toFixed(2)} 
                    </li>
                  ))}
                  
                </ul>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default OrderHistory;


