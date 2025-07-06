import '../styles/Products.css'
import React from 'react'
import '../styles/CartPopup.css'
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Minus } from 'lucide-react';

function CartPopup({ cart, removeFromCart }) {
  const [isMinimized, setIsMinimized] = useState(false);
  const navigate = useNavigate();

  if (cart.length === 0 && !isMinimized) {
    return null;
  }

  const totalPrice = cart.reduce((sum, item) => {
    return sum + item.price_cents * item.quantity;
  }, 0)

  return (
    <div className={`cart-popup ${isMinimized ? 'minimized' : ''}`}>
      {!isMinimized ? (
        <>
          <h3 className='cart-popup-header'>
            <span className='popup-nav-text'>Your Cart</span>
            <button 
              onClick={() => setIsMinimized(true)}
            >
              <Minus />
            </button>
          </h3>
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
                    {item.slug} × {item.quantity} = ${(item.price_cents * item.quantity / 100).toFixed(2)}
                    <button onClick={() => removeFromCart(item)}>X</button>
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
              <span className='cart-total'>
                Total: ${(totalPrice / 100).toFixed(2)}
              </span>
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