import './App.css';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import { useEffect, useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import AppRoutes from './AppRoutes.jsx';
import React from 'react';

const App = () => {
  const [cart, setCart] = useState([]);
  const [showCartPopup, setShowCartPopup] = useState(false);

  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userInfo = localStorage.getItem('user');

    if (token && userInfo) {
      setUser (JSON.parse(userInfo));
    }
  }, []);

  const addToCart = (product) => {

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

  const removeFromCart = (product) => {

    setCart((prevCart) => {
      const existingItemIndex = prevCart.findIndex((item) => item.id === product.id);

      const updatedCart = [...prevCart];

    if (updatedCart[existingItemIndex].quantity > 1) {
      updatedCart[existingItemIndex].quantity -= 1;
      return updatedCart;
    } else {
      updatedCart.splice(existingItemIndex, 1);
      return updatedCart;
    }
  });
};

  return (
    <BrowserRouter>
      <Navbar user={user}/>
      <AppRoutes
        cart={cart}
        addToCart={addToCart}
        removeFromCart={removeFromCart}
        showCartPopup={showCartPopup}
        setShowCartPopup={setShowCartPopup}
      />
      <Footer />
    </BrowserRouter>
  );
};

export default App;