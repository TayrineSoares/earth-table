import loadingAnimation from '../assets/loading.json'
import { useState, useEffect } from 'react';
import Lottie from 'lottie-react';
import checkoutImage from "../assets/images/checkoutImage.png"
import { loadStripe } from '@stripe/stripe-js';
import { supabase } from '../supabaseClient';
import PickupSelector from '../components/PickupSelector';
import "../styles/Cart.css"
import { Link} from "react-router-dom";


const Cart = ({ cart, removeOneFromCart, addOneFromCart, removeAll }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [pickupDate, setPickupDate] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);
  const [specialNote, setSpecialNote] = useState("");
  const [uberDelivery, setUberDelivery] = useState(false);
  const [showDeliveryWarning, setShowDeliveryWarning] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

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

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsLoggedIn(!!session);
    };
    checkSession();
  }, []);

  const totalPrice = cart.reduce((sum, item) => {
    return sum + item.price_cents * item.quantity;
  }, 0)

  if (isLoading) {
    return (
      <div 
        className="loading-container" 
        style={{
          minHeight: "80vh", 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center"
        }}
      >
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
      body: JSON.stringify({ 
        cartItems: cart, 
        email, 
        userId,
        pickup_date: pickupDate,
        pickup_time_slot: pickupTime,
        delivery: uberDelivery,
        special_note: specialNote
       }),
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

      {showDeliveryWarning && (
            <div className="delivery-warning-overlay">
              <div className="delivery-warning-box">
              <h2 className='warning-text'>
                <span className='warning-symbol'>⚠</span> Delivery Instructions <span className='warning-symbol'>⚠</span>
              </h2>
                <p className='warning-text-details'>
                  If you'd like delivery via Uber Courier, please email us at hello@earthtableco.ca. 
                  We'll reply to confirm availability and cost based on Uber rates. 
                  Checking this box <strong>does not schedule delivery</strong>. 
                  If delivery cannot be confirmed, your order will be prepared for <strong>pickup</strong> at the scheduled time.
                </p>
                <button 
                  className='warning-button'
                  onClick={() => setShowDeliveryWarning(false)}
                >OK</button>
              </div>
            </div>
          )}

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
              <p className='total'>${(totalPrice * 1.13 / 100 ).toFixed(2)}</p>
            </div>
            
            <PickupSelector 
              pickupDate={pickupDate}
              pickupTime={pickupTime}
              onDateChange={setPickupDate}
              onTimeChange={setPickupTime}
            />

            <div className="general-text">
              <input
                type="checkbox"
                id="uber-delivery"
                checked={uberDelivery}
                disabled={!isLoggedIn}
                onChange={(e) => {
                  if (!isLoggedIn) return;
                  setUberDelivery(e.target.checked);
                  if (e.target.checked) {
                    setShowDeliveryWarning(true);
                  }
                }}
              />
              <label htmlFor="uber-delivery">
                We offer delivery via <Link className="footer-account-register" to="/privacy">Uber Carrier</Link>. 
                
                {!isLoggedIn && <span className="login-warning"> (Log in to request delivery info)</span>}
              </label>
            </div>

            <div className="special-note-container" >
              <label htmlFor="special-note" className='general-text'>Special Instructions (optional)</label>
              <textarea
                className='special-note-input'
                id="special-note"
                value={specialNote}
                onChange={(e) => setSpecialNote(e.target.value)}
                placeholder="Allergies, special instructions..."
                rows="3"
              />
            </div>

            <div className="general-text">
              <input
                type="checkbox"
                id="privacy-agree"
                checked={agreedToPrivacy}
                onChange={(e) => setAgreedToPrivacy(e.target.checked)}
              />
              <label htmlFor="privacy-agree">
                I have read and agree to the <Link className="footer-account-register" to="/privacy">Privacy Policy</Link>.
              </label>
            </div>
            
            <button 
              disabled={!pickupDate || !pickupTime || !agreedToPrivacy}
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