import './App.css';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppRoutes from './AppRoutes.jsx';
import { supabase } from './supabaseClient';

const App = () => {
  const [cart, setCart] = useState([]);
  const [showCartPopup, setShowCartPopup] = useState(false);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // 1. Load guest cart immediately on mount (for not logged in users)
    const guestCart = localStorage.getItem('cart_guest');
    setCart(guestCart ? JSON.parse(guestCart) : []);
    setShowCartPopup(guestCart ? JSON.parse(guestCart).length > 0 : false);
  
    // 2. Then get user session asynchronously and load user cart if logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user || null;
      setUser(currentUser);
  
      if (currentUser) {
        const savedCart = localStorage.getItem(`cart_${currentUser.id}`);
        const parsedCart = savedCart ? JSON.parse(savedCart) : [];
        setCart(parsedCart);
        setShowCartPopup(parsedCart.length > 0);
      }
    });
  
    // 3. Listen to auth state changes (login/logout)
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user || null;
      setUser(currentUser);
  
      if (currentUser) {
        const savedCart = localStorage.getItem(`cart_${currentUser.id}`);
        const parsedCart = savedCart ? JSON.parse(savedCart) : [];
        setCart(parsedCart);
        setShowCartPopup(parsedCart.length > 0);
      } else {
        // logged out, restore guest cart
        const guestCart = localStorage.getItem('cart_guest');
        const parsedGuestCart = guestCart ? JSON.parse(guestCart) : [];
        setCart(parsedGuestCart);
        setShowCartPopup(parsedGuestCart.length > 0);
      }
    });
  
    return () => {
      listener?.subscription.unsubscribe();
    };
  }, []);  

  // Save cart to localStorage on cart or user change
  useEffect(() => {
    if (user) {
      localStorage.setItem(`cart_${user.id}`, JSON.stringify(cart));
    } else {
      localStorage.setItem('cart_guest', JSON.stringify(cart));
    }
  }, [cart, user]);

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error('Logout failed:', error.message);
      }

      setUser(null);
      navigate('/login');
    } catch (err) {
      console.error('Logout error:', err.message);
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

  const removeAll = (product) => {
    setCart((prevCart) => prevCart.filter(item => item.id !== product.id));
  };

  const removeOneFromCart = (product) => {
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

  const addOneFromCart = (product) => {
    setCart((prevCart) => {
      const existingItemIndex = prevCart.findIndex((item) => item.id === product.id);
      const updatedCart = [...prevCart];

      if (existingItemIndex !== -1) {
        updatedCart[existingItemIndex].quantity += 1;
      }
      return updatedCart;
    });
  };

  const clearCart = () => {
    setCart([]);
    if (user) {
      localStorage.setItem(`cart_${user.id}`, JSON.stringify([]));
    } else {
      localStorage.setItem('cart_guest', JSON.stringify([]));
    }
  };

  return (
    <div>
      <Navbar 
        user={user} 
        onLogout={handleLogout}
        cart={cart}
      />
      <AppRoutes
        user={user}
        setUser={setUser}
        cart={cart}
        addToCart={addToCart}
        removeOneFromCart={removeOneFromCart}
        addOneFromCart={addOneFromCart}
        removeAll={removeAll}
        showCartPopup={showCartPopup}
        setShowCartPopup={setShowCartPopup}
        clearCart={clearCart}  
      />
      <Footer />
    </div>
  );
};

export default App;


