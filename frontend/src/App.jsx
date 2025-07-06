import './App.css';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import { useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import AppRoutes from './AppRoutes.jsx'; // 👈 create this file
import React from 'react';

const App = () => {
  const [cart, setCart] = useState([]);
  const [showCartPopup, setShowCartPopup] = useState(false);

  const addToCart = (product) => {
    console.log('addToCart called for', product.slug);

    setCart((prevCart) => {
      const existingItemIndex = prevCart.findIndex((item) => item.id === product.id);

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
      <AppRoutes
        cart={cart}
        addToCart={addToCart}
        showCartPopup={showCartPopup}
        setShowCartPopup={setShowCartPopup}
      />
      <Footer />
    </BrowserRouter>
  );
};

export default App;