import { useEffect, useRef } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import {
  Home,
  About,
  Contact,
  Products,
  SubscribeAndSave,
  SubscribeMeals,
  SubscribeAddons,
  SubscribeCart,
  SubscribeConfirmation,
  MySubscriptions,
  SubscribeEditMeals,
  SubscribeEditAddons,
  SubscribeEditCart,
  Cart,
  Confirmation,
  Admin,
  Login,
  Register,
  Profile,
  ResetPassword,
  UpdatePassword,
  ProductDetail,
  OrderHistory,
  AuthCallback,

} from './pages/index.js';
import CartPopup from './components/CartPopup.jsx';
import SubscribeCartPopup from './components/SubscribeCartPopup.jsx';
import PrivacyPolicy from './components/PrivacyPolicy.jsx';

const AppRoutes = ({
  cart,
  addToCart,
  showCartPopup,
  setShowCartPopup,
  removeOneFromCart,
  addOneFromCart,
  setUser,
  removeAll,
  user,
  clearCart,
  clearSubCart,
  subCart,
  setSubCart,
  bumpSubMeal,
  bumpSubAddon,
  showSubCartPopup,
}) => {
  const location = useLocation();
  const onSubscribeSignup = location.pathname.startsWith('/subscribe/')
    && location.pathname !== '/subscribe/confirmation';
  const onSubscribeCart = location.pathname === '/subscribe/cart';

  const prevPathRef = useRef(null);

  // SPA pages keep the previous scroll; meals → add-ons would stay mid-catalog.
  // Menu category tabs only change the listing path — keep the scroll position.
  useEffect(() => {
    const prev = prevPathRef.current;
    prevPathRef.current = location.pathname;
    if (location.hash) return;
    const isMenuListing = (path) => (
      path === '/products/category' || path.startsWith('/products/category/')
    );
    if (prev && isMenuListing(prev) && isMenuListing(location.pathname)) return;
    window.scrollTo(0, 0);
  }, [location.pathname, location.hash]);

  return (
    <>
      <div className='main'>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/subscribe-and-save" element={<SubscribeAndSave />} />
          <Route
            path="/subscribe/:planId/meals"
            element={
              <SubscribeMeals
                subCart={subCart}
                setSubCart={setSubCart}
                bumpSubMeal={bumpSubMeal}
              />
            }
          />
          <Route
            path="/subscribe/:planId/addons"
            element={
              <SubscribeAddons
                subCart={subCart}
                bumpSubAddon={bumpSubAddon}
              />
            }
          />
          <Route
            path="/subscribe/cart"
            element={<SubscribeCart user={user} subCart={subCart} bumpSubMeal={bumpSubMeal} bumpSubAddon={bumpSubAddon} />}
          />
          <Route
            path="/subscribe/confirmation"
            element={<SubscribeConfirmation clearSubCart={clearSubCart} />}
          />
          <Route
            path="/my-subscriptions"
            element={<MySubscriptions user={user} />}
          />
          <Route
            path="/my-subscriptions/:subscriptionId/meals"
            element={<SubscribeEditMeals user={user} />}
          />
          <Route
            path="/my-subscriptions/:subscriptionId/addons"
            element={<SubscribeEditAddons user={user} />}
          />
          <Route
            path="/my-subscriptions/:subscriptionId/cart"
            element={<SubscribeEditCart user={user} />}
          />
          <Route
            path="/products/category/:categoryId?"
            element={<Products
              addToCart={addToCart}
              cart={cart}
              removeOneFromCart={removeOneFromCart}
            />}
          />
          <Route path="/cart" element={<Cart 
                                        cart={cart}
                                        removeOneFromCart={removeOneFromCart}
                                        addOneFromCart={addOneFromCart}
                                        removeAll={removeAll}
                                      />} 
                                    />
          <Route path="/login" element={<Login setUser={setUser} />} />
          <Route path="/confirmation" element={<Confirmation user={user} clearCart={clearCart} />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/register" element={<Register setUser={setUser} />} />
          <Route path="/profile/:auth_user_id" element={<Profile />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/update-password" element={<UpdatePassword />} />
          <Route path="/products/:id" element={<ProductDetail />} />
          <Route path="/orders/:userId?" element={
            <OrderHistory
              user={user}
              addToCart={addToCart}
            />
          } />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
        </Routes>
    
      </div>

      {showCartPopup && location.pathname !== '/cart' && !onSubscribeSignup && (
        <CartPopup 
          cart={cart}
          removeOneFromCart={removeOneFromCart}
          addOneFromCart={addOneFromCart}
          removeAll={removeAll}
          onClose={() => setShowCartPopup(false)} 
        />
      )}
      {showSubCartPopup && onSubscribeSignup && !onSubscribeCart && (
        <SubscribeCartPopup
          subCart={subCart}
          bumpSubMeal={bumpSubMeal}
          bumpSubAddon={bumpSubAddon}
        />
      )}
    </>
  );
};

export default AppRoutes;