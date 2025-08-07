import { Routes, Route, useLocation } from 'react-router-dom';
import {
  Home,
  About,
  Contact,
  Products,
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
  

} from './pages/index.js';
import CartPopup from './components/CartPopup.jsx';

const AppRoutes = ({ cart, addToCart, showCartPopup, setShowCartPopup, removeOneFromCart, addOneFromCart, setUser, removeAll, user, clearCart }) => {
  const location = useLocation();

  return (
    <>
      <div className='main'>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route
            path="/products/category/:categoryId?"
            element={<Products 
              addToCart={addToCart} 
              cart={cart} 
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
          <Route path="/confirmation" element={<Confirmation clearCart={clearCart} />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/register" element={<Register setUser={setUser} />} />
          <Route path="/profile/:auth_user_id" element={<Profile />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/update-password" element={<UpdatePassword />} />
          <Route path="/products/:id" element={<ProductDetail />} />
          <Route path="/orders/:userId?" element={<OrderHistory user={user}/>} />
        </Routes>
      </div>

      {showCartPopup && location.pathname !== '/cart' && (
        <CartPopup 
          cart={cart}
          removeOneFromCart={removeOneFromCart}
          addOneFromCart={addOneFromCart}
          removeAll={removeAll}
          onClose={() => setShowCartPopup(false)} 
        />
      )}
    </>
  );
};

export default AppRoutes;