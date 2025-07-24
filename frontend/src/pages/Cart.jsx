import loadingAnimation from '../assets/loading.json'
import { useState, useEffect } from 'react';
import Lottie from 'lottie-react';

const Cart = ({ cart, removeOneFromCart }) => {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('http://localhost:8080/cart')
      .then(res => {
        if(!res.ok) {
          throw new Error(`HTTP Error.${res.status}`);
        }
        return res.json()
      })
      .then(data => {
        setAllProducts(data);
        setIsLoading(false);
      })
      .catch(err => {
        console.error(err);
        setIsLoading(false);
      });
  }, []);

  const totalPrice = cart.reduce((sum, item) => {
    return sum + item.price_cents * item.quantity;
  }, 0)

  if (isLoading) {
    return (
      <div className="loading-container">
        <Lottie animationData={loadingAnimation} loop={true} />
      </div>
    );
  }

  return (
    <div>
      <h1>Cart Page!</h1>
      {cart.map(item => (
        <div key={item.id}>
          <h3>{item.slug} x {item.quantity}</h3>
          <img 
            src={item.image_url}
            className='product-image'
          />
          <div>${(item.price_cents * item.quantity / 100).toFixed(2)}</div>
          <button
            onClick={() => removeOneFromCart(item)}
          >
            Remove
          </button>
        </div>
      ))}
      <div>
        <span>
          Total: ${(totalPrice / 100).toFixed(2)}
        </span>
      </div>
    </div>
  )
};

export default Cart;