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
    // Check if a session exists (only during this sessionStorage lifespan)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
    });

    // Listen for auth changes
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => {
      listener?.subscription.unsubscribe();
    };
  }, []);


  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut(); // Supabase logout

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
    setCart((prevCart) => {
      return prevCart.filter(item => item.id !== product.id);
    });
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

  if (updatedCart[existingItemIndex].quantity >= 1) {
    updatedCart[existingItemIndex].quantity += 1;
    return updatedCart;
  }
});
};

  return (
    <div>
      <Navbar user={user} onLogout={handleLogout}/>
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