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

  // Load cart from localStorage & set user on app start & auth changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user || null;
      setUser(currentUser);

      if (currentUser) {
        // Load logged-in user's cart or empty
        const savedCart = localStorage.getItem(`cart_${currentUser.id}`);
        setCart(savedCart ? JSON.parse(savedCart) : []);
      } else {
        // Load guest cart or empty
        const guestCart = localStorage.getItem('cart_guest');
        setCart(guestCart ? JSON.parse(guestCart) : []);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user || null;
      setUser(currentUser);

      if (currentUser) {
        const savedCart = localStorage.getItem(`cart_${currentUser.id}`);
        setCart(savedCart ? JSON.parse(savedCart) : []);
      } else {
        const guestCart = localStorage.getItem('cart_guest');
        setCart(guestCart ? JSON.parse(guestCart) : []);
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

  return (
    <div>
      <Navbar user={user} onLogout={handleLogout} />
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
      />
      <Footer />
    </div>
  );
};

export default App;
