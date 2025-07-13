import './App.css';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import { useEffect, useState } from 'react';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import AppRoutes from './AppRoutes.jsx';


const App = () => {
  const [cart, setCart] = useState([]);
  const [showCartPopup, setShowCartPopup] = useState(false);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();


  useEffect(() => {
    const token = localStorage.getItem('token');
    const userInfo = localStorage.getItem('user');

    if (token && userInfo) {
      setUser (JSON.parse(userInfo));
    }
  }, []);


  const handleLogout = async () => {
    try {
      const res = await fetch('http://localhost:8080/logout', {
    method: 'POST',
    });

    //handle http errors
    if (!res.ok) {
      throw new Error(`HTTP error. Status: ${res.status}`);
    }

    const data = await res.json(); 
    console.log(data.message);

    //check if the backend returned an error message in the JSON
    if (data.error) {
      console.error('Logout failed:', data.error);
    } else {
      console.log(data.message);
    }

    //clear local storage
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    navigate('/login');
      } catch (err) {
      //catch network errors or thrown errors and log them
       console.error('Logout request failed:', err.message);
      }
    };

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
      <Navbar user={user} onLogout={handleLogout}/>
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