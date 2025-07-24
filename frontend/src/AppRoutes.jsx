import { Routes, Route, useLocation } from 'react-router-dom';
import {
  Home,
  About,
  Contact,
  Products,
  Cart,
  Checkout,
  Confirmation,
  Admin,
  Login,
  Register,
  Profile,
  ResetPassword,
  UpdatePassword,

} from './pages/index.js';
import CartPopup from './components/CartPopup.jsx';

const AppRoutes = ({ cart, addToCart, showCartPopup, setShowCartPopup, removeFromCart, setUser }) => {
  const location = useLocation();

  return (
    <>
      <div className='main'>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route
            path="/products/:categoryId?"
            element={<Products 
              addToCart={addToCart} 
              cart={cart} 
            />}
          />
          <Route path="/cart" element={<Cart 
                                        cart={cart}
                                        removeFromCart={removeFromCart}
                                      />} 
                                    />
          <Route path="/login" element={<Login setUser={setUser} />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/confirmation" element={<Confirmation />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/register" element={<Register setUser={setUser} />} />
          <Route path="/profile/:auth_user_id" element={<Profile />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/update-password" element={<UpdatePassword />} />
        </Routes>
      </div>

      {showCartPopup && location.pathname !== '/cart' && (
        <CartPopup 
          cart={cart}
          removeFromCart={removeFromCart}
          onClose={() => setShowCartPopup(false)} 
        />
      )}
    </>
  );
};

export default AppRoutes;