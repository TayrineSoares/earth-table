import '../styles/Products.css'
import React from 'react'
import '../styles/CartPopup.css'
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function CartPopup({ cart, onClose }) {
  const [isMinimized, setIsMinimized] = useState(false);
  const navigate = useNavigate();

  if (cart.length === 0 && !isMinimized) {
    return null;
  }

  return (
    <div className={`cart-popup ${isMinimized ? 'minimized' : ''}`}>
      {!isMinimized ? (
        <>
          <h3 className='cart-popup-header'>Your Cart</h3>
          {cart.length === 0 ? (
            <p>Cart is empty</p>
          ) : (
            <div className="cart-popup-container">
              <ul className="cart-popup-items">
                {cart.map(item => (
                  <li key={item.id}>
                    <img
                      className="cart-popup-image"
                      src={item.image_url}
                      alt={item.slug}
                    />
                    {item.slug} × {item.quantity}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="cart-popup-footer">
              <button 
                onClick={() => navigate('/cart')}
              >
                View Cart
              </button>
              <button 
                onClick={() => setIsMinimized(true)}
              >
                Close
              </button>
          </div>
        </>
      ) : (
        <div className="minimized-bar" onClick={() => setIsMinimized(false)}>
          🛒 Cart ({cart.length})
        </div>
      )}
    </div>
  );
}

export default CartPopup;