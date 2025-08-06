import loadingAnimation from '../assets/loading.json'
import { useState, useEffect } from 'react';
import Lottie from 'lottie-react';
import checkoutImage from "../assets/images/checkoutImage.png"
import { loadStripe } from '@stripe/stripe-js';
import { supabase } from '../supabaseClient';
import "../styles/Cart.css"


const Cart = ({ cart, removeOneFromCart, addOneFromCart, removeAll }) => {
  const [isLoading, setIsLoading] = useState(true);

  const [deliveryMethod, setDeliveryMethod] = useState("pickup");
  const [pickupPaymentOption, setPickupPaymentOption] = useState("stripe");
 
  useEffect(() => {
    fetch('http://localhost:8080/cart')
      .then(res => {
        if(!res.ok) {
          throw new Error(`HTTP Error.${res.status}`);
        }
        return res.json()
      })
      .then(data => {
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

  const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

  const handleCheckout = async () => {
    //get supabase session 
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
      console.error("Error getting Supabase session:", error.message);
    }

    const userId = session?.user?.id || null;
    const email = session?.user?.email || null;

    const stripe = await stripePromise;  

    const response = await fetch('http://localhost:8080/create-checkout-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ cartItems: cart, email, userId }),
    });

    const data = await response.json();

    if (data.url) {
      window.location.href = data.url;
    } else {
      console.error('Checkout failed');
    }
  };

  return (
    <div className='checkout-page'>
      <div className='checkout-page-header-image'>
        <img 
          src={checkoutImage}
          className='checkout-image'
        />
      </div>

      <div className='page-wrapper'>
        <div className='checkout-page-container'>
          
          
          <div className='checkout-order-summary'>

            <p className='checkout-summary-text'>Order Summary</p>
            
            <div className='checkout-summary-items'>
              <p className='number-of-items'>{cart.length} ITEMS</p>
            </div>
            
            <div className='checkout-summary-subtotal'>
              <p className='subtotal'>SUBTOTAL</p>
              <p className='subtotal'>${(totalPrice / 100).toFixed(2)}
              </p>
            </div>

            <div className='checkout-summary-tax'>
              <p className='tax'>HST</p>
              <p className='tax'>13%</p>
            </div>

            <div className='checkout-total'>
              <p className='total'>Total</p>
              <p className='total'>{(totalPrice * 1.13 / 100 ).toFixed(2)}</p>
            </div>

            
            <button 
              onClick={handleCheckout}
              className="checkout-button"
            >
              Proceed to Checkout
            </button>
          </div>

          <div className='checkout-items'>
            {cart.map(item => (
              <div
                className='checkout-items-container' 
                key={item.id}
              >
                <img 
                  src={item.image_url}
                  className='checkout-product-image'
                />
                
                <div className='checkout-item-details'>
                  <p className='checkout-item-title'>{item.slug}</p>
                  <p className='checkout-item-price'>${(item.price_cents * item.quantity / 100).toFixed(2)}</p>
                  
                  <div className="cart-popup-item-quantity-container">
                    <p className='checkout-quantity'>QTY:</p>
                    <div className='checkout-quantity-button-container'>
                      <button 
                        onClick={() => removeOneFromCart(item)}
                        className='checkout-cart-popup-remove-button'
                      >-
                      </button>
                      <p className='checkout-item-quantity'>{item.quantity}</p>
                      <button 
                        onClick={() => addOneFromCart(item)}
                        className='checkout-cart-popup-add-button'
                      > + 
                      </button>
                    </div>
                    <button className="checkout-popup-remove-button"onClick={() => removeAll(item)}>REMOVE</button>
                  </div>
                </div>
              
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  )
};

export default Cart;