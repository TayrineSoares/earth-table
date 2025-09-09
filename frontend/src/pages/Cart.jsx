import loadingAnimation from '../assets/loading.json'
import { useState, useEffect } from 'react';
import Lottie from 'lottie-react';
import checkoutImage from "../assets/images/checkoutImage.png"
import { loadStripe } from '@stripe/stripe-js';
import { supabase } from '../supabaseClient';
import PickupSelector from '../components/PickupSelector';
import DeliverySelector from '../components/DeliverySelector';
import "../styles/Cart.css"
import { Link} from "react-router-dom";


const Cart = ({ cart, removeOneFromCart, addOneFromCart, removeAll }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [pickupDate, setPickupDate] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);
  const [specialNote, setSpecialNote] = useState("");

  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // NEW: fulfillment mode + delivery info
  const [fulfillment, setFulfillment] = useState("pickup"); // "pickup" | "delivery"
  const [postalCode, setPostalCode] = useState("");
  const [postalValid, setPostalValid] = useState(false);
  const [deliveryFeeCents, setDeliveryFeeCents] = useState(0); // step 1: keep 0

  useEffect(() => {
    fetch('/api/cart')
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

  const subtotalCents = cart.reduce((sum, item) => {
    return sum + item.price_cents * item.quantity;
  }, 0);

  // CHANGED: add deliveryFeeCents into total
  const hstRate = 0.13;
  const totalBeforeTaxCents = subtotalCents + (fulfillment === "delivery" ? deliveryFeeCents : 0);
  const taxCents = Math.round(totalBeforeTaxCents * hstRate);
  const grandTotalCents = totalBeforeTaxCents + taxCents;

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
    
    
    const response = await fetch('/api/create-checkout-session', {
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
        delivery: fulfillment === "delivery",

        // NEW: send delivery info placeholders (server should validate in Step 2+)
        delivery_postal_code: postalCode || null,
        delivery_fee_cents: fulfillment === "delivery" ? deliveryFeeCents : 0,

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

  const getCartItemCount = (cart) => {
    return cart.reduce((total, item) => total + item.quantity, 0);
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
              <p className='number-of-items'>{getCartItemCount(cart)} ITEMS</p>
            </div>
            
            {/* NEW: fulfillment toggle */}
            <div className="general-text" style={{ margin: "10px 0 16px" }}>
              <label style={{ marginRight: 16 }}>
                <input
                  type="radio"
                  name="fulfillment"
                  value="pickup"
                  checked={fulfillment === "pickup"}
                  onChange={() => setFulfillment("pickup")}
                />{" "}
                Pickup
              </label>
              <label>
                <input
                  type="radio"
                  name="fulfillment"
                  value="delivery"
                  checked={fulfillment === "delivery"}
                  onChange={() => setFulfillment("delivery")}
                />{" "}
                Delivery
              </label>
            </div>

            {/* SUBTOTAL */}
            <div className='checkout-summary-subtotal'>
              <p className='subtotal'>SUBTOTAL</p>
              <p className='subtotal'>${(subtotalCents / 100).toFixed(2)}</p>
            </div>

            {/* NEW: delivery fee row appears only if Delivery selected */}
            {fulfillment === "delivery" && (
              <div className='checkout-summary-subtotal'>
                <p className='subtotal'>Delivery fee</p>
                <p className='subtotal'>
                  {deliveryFeeCents > 0 ? `$${(deliveryFeeCents / 100).toFixed(2)}` : "$0.00"}
                </p>
              </div>
            )}

            {/* TAX */}
            <div className='checkout-summary-tax'>
              <p className='tax'>HST</p>
              <p className='tax'>13%</p>
            </div>

            {/* TOTAL */}
            <div className='checkout-total'>
              <p className='total'>Total</p>
              <p className='total'>${(grandTotalCents / 100).toFixed(2)}</p>
            </div>

            {/* PICKUP or DELIVERY SELECTOR */}
            {fulfillment === "pickup" ? (
              <PickupSelector 
                pickupDate={pickupDate}
                pickupTime={pickupTime}
                onDateChange={setPickupDate}
                onTimeChange={setPickupTime}
              />
            ) : (
              <DeliverySelector
                postalCode={postalCode}
                onPostalCodeChange={setPostalCode}
                feeCents={deliveryFeeCents}
                onValidate={({ valid }) => setPostalValid(valid)}
              />
            )}


            <div className="special-note-container">
              <label htmlFor="special-note" className='general-text'>Special Instructions </label>
              <textarea
                className='special-note-input'
                id="special-note"
                value={specialNote}
                onChange={(e) => setSpecialNote(e.target.value)}
                placeholder={
                  fulfillment === "delivery"
                    ? "Full delivery address, allergies, special instructions..."
                    : "Allergies, special instructions..."
                }
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
              disabled={
                !agreedToPrivacy ||
                (fulfillment === "pickup" && (!pickupDate || !pickupTime)) ||
                (fulfillment === "delivery" && (!postalValid)) // step 1: require valid postal format
              }
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