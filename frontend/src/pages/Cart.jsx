import loadingAnimation from '../assets/loading.json'
import { useState, useEffect } from 'react';
import Lottie from 'lottie-react';

const Cart = ({ cart, removeFromCart }) => {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('http://localhost:8080/cart')
      .then(res => res.json())
      .then(data => {
        setAllProducts(data);
        setIsLoading(false);
      })
      .catch(err => {
        console.error(err);
        setIsLoading(false);
      });
  }, []);

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
          <button
            onClick={() => removeFromCart(item)}
          >
            Remove
          </button>
        </div>
      ))}
    </div>
  )
};

export default Cart;