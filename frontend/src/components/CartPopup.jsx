import '../styles/Products.css'
import React from 'react'
import '../styles/CartPopup.css'

function CartPopup({ cart, onClose }) {
  return (
    <div className='cart-popup'>
      <h3>Your Cart</h3>
      {cart.length === 0 ? (
        <p>Cart is empty</p>
      ) : (
        <ul>
          {cart.map(item => (
            <li key={item.id}>
              <img 
              className='cart-popup-image'
              src={item.image_url}
              />
              {item.slug} × {item.quantity}
            </li>
          ))}
        </ul>
      )}
      <button onClick={onClose}>Close</button>
    </div>
  );
};

export default CartPopup