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
} from './pages/index.js';
import CartPopup from './components/CartPopup.jsx';

const AppRoutes = ({ cart, addToCart, showCartPopup, setShowCartPopup, removeFromCart }) => {
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
          <Route path="/login" element={<Login />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/confirmation" element={<Confirmation />} />
          <Route path="/admin" element={<Admin />} />
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