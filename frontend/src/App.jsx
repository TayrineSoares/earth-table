import './App.css'
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
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
import React from 'react';
import CartPopup from './components/CartPopup.jsx'


const App = () => {
  const [ cart, setCart ] = useState([]);
  const [showCartPopup, setShowCartPopup] = useState(false);

  const addToCart = (product) => {
    console.log('addToCart called for', product.slug);
  
    setCart((prevCart) => {
      const existingItemIndex = prevCart.findIndex(item => item.id === product.id);
  
      if (existingItemIndex !== -1) {
        const updatedCart = [...prevCart];
        updatedCart[existingItemIndex].quantity += 1;
        return updatedCart;
      } else {
        return [...prevCart, { ...product, quantity: 1 }];
      }
    });

    setShowCartPopup(true);
  };

  return (
    <BrowserRouter>

      <Navbar />
      <div className='main'>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/products" element={<Products 
                                            addToCart={addToCart} 
                                            cart={cart}/>} 
                                          />
          <Route path="/cart" element={<Cart 
                                        cart={cart}
                                      />} />
          <Route path="/login" element={<Login />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/confirmation" element={<Confirmation />} />
          <Route path="/admin" element={<Admin />} />

        </Routes>
      </div>

      {showCartPopup && (
        <CartPopup cart={cart} onClose={() => setShowCartPopup(false)} />
      )}

      <Footer />
    </BrowserRouter>
  );
}

export default App;