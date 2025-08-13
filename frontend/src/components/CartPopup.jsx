import '../styles/Products.css'
import React from 'react'
import '../styles/CartPopup.css'
import { useState } from 'react';
import { Minus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

function CartPopup({ cart, removeOneFromCart, addOneFromCart, removeAll }) {
  const [isMinimized, setIsMinimized] = useState(true);
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
                    <li key={item.id} className="cart-popup-item">
                      <img
                        className="cart-popup-image"
                        src={item.image_url}
                        alt={item.slug}
                      />
                      <div className="cart-popup-item-details-1">
                        <span className="cart-popup-item-name">{item.slug}</span>
                        <span className="cart-popup-item-quantity">QTY:
                          <div className='quantity-button-container'>
                            <button 
                                onClick={() => removeOneFromCart(item)}
                                className='cart-popup-add-remove-button'
                                >-
                            </button>
                            {item.quantity}
                            <button 
                              onClick={() => addOneFromCart(item)}
                              className='cart-popup-add-remove-button'
                              > + 
                            </button>
                          </div>
                        </span>
                      </div>
                      <div className="cart-popup-item-details-2">
                        <span className="cart-popup-item-total-price">
                          ${(item.price_cents * item.quantity / 100).toFixed(2)}
                        </span>
                        <button className="cart-popup-remove-button"onClick={() => removeAll(item)}>REMOVE</button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
          )}
            <div className="cart-popup-footer">
              <p className='cart-total-text'>TOTAL COST:</p>
              <p className='cart-total'>${(totalPrice / 100).toFixed(2)}
              </p>
              <div className='go-to-chekout-button-container'>
              <button 
                className='go-to-chekout-button'
                onClick={() => navigate('/cart')}
              >
                GO TO CHECKOUT
              </button>
              </div>
          </div>
        </>
      ) : (
        <div className="minimized-bar">
          <span>Your Cart ({cart.length})</span>
          <button
            className="expand-button"
            onClick={() => setIsMinimized(false)}
            aria-label="Expand cart"
          >
            +
          </button>
        </div>
      )}
    </div>
  );
}

export default CartPopup;