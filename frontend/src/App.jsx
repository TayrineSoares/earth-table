import './App.css';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppRoutes from './AppRoutes.jsx';
import { supabase } from './supabaseClient';
import {
  adoptGuestSubCart,
  bumpAddon,
  bumpMeal,
  emptySubCart,
  readSubCart,
  totalQty,
  writeSubCart,
} from './helpers/subscriptionCart';

const App = () => {
  const [cart, setCart] = useState([]);
  const [showCartPopup, setShowCartPopup] = useState(false);
  const [subCart, setSubCart] = useState(() => readSubCart(null));
  const [showSubCartPopup, setShowSubCartPopup] = useState(false);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  const readStoredCart = (key) => {
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const mergeIntoCart = (prevCart, products) => {
    const next = [...prevCart];
    for (const product of products) {
      if (!product?.id) continue;
      const qty = Math.max(1, Number(product.quantity) || 1);
      const existingItemIndex = next.findIndex((item) => item.id === product.id);
      if (existingItemIndex !== -1) {
        next[existingItemIndex] = {
          ...next[existingItemIndex],
          quantity: next[existingItemIndex].quantity + qty,
        };
      } else {
        const { quantity: _quantity, ...rest } = product;
        next.push({ ...rest, quantity: qty });
      }
    }
    return next;
  };

  /** Load user cart and fold in any guest cart items from before login. */
  const adoptCartForUser = (currentUser) => {
    const userKey = `cart_${currentUser.id}`;
    const merged = mergeIntoCart(
      readStoredCart(userKey),
      readStoredCart('cart_guest')
    );
    localStorage.setItem(userKey, JSON.stringify(merged));
    localStorage.setItem('cart_guest', JSON.stringify([]));
    setCart(merged);
    setShowCartPopup(merged.length > 0);
  };

  const adoptSubCartForUser = (currentUser) => {
    // Guest signup with a plan replaces the user box (two plans are not merged).
    const next = adoptGuestSubCart(currentUser.id);
    setSubCart(next);
    const count = totalQty(next.meals) + totalQty(next.addons);
    setShowSubCartPopup(count > 0);
  };

  const wipeSubCart = (currentUser) => {
    const empty = emptySubCart();
    setSubCart(empty);
    setShowSubCartPopup(false);
    writeSubCart(null, empty);
    if (currentUser) writeSubCart(currentUser.id, empty);
  };

  const isALaCarteSuccess = () =>
    sessionStorage.getItem('clear_cart_after_order') ||
    (window.location.pathname.startsWith('/confirmation')
      && !window.location.pathname.startsWith('/subscribe'));

  const isSubSuccess = () =>
    sessionStorage.getItem('clear_sub_cart_after_subscribe') ||
    window.location.pathname.startsWith('/subscribe/confirmation');

  useEffect(() => {
    const fromCheckout = window.location.pathname.startsWith('/confirmation')
      && !window.location.pathname.startsWith('/subscribe');
    const fromSubCheckout = window.location.pathname.startsWith('/subscribe/confirmation');
    if (fromCheckout) {
      sessionStorage.setItem('clear_cart_after_order', '1');
      setCart([]);
      setShowCartPopup(false);
      localStorage.setItem('cart_guest', JSON.stringify([]));
    } else {
      const guestCart = readStoredCart('cart_guest');
      setCart(guestCart);
      setShowCartPopup(guestCart.length > 0);
      if (!fromSubCheckout && !sessionStorage.getItem('clear_sub_cart_after_subscribe')) {
        const guestSub = readSubCart(null);
        setSubCart(guestSub);
        setShowSubCartPopup(totalQty(guestSub.meals) + totalQty(guestSub.addons) > 0);
      }
    }

    if (fromSubCheckout) {
      sessionStorage.setItem('clear_sub_cart_after_subscribe', '1');
      setSubCart(emptySubCart());
      setShowSubCartPopup(false);
      writeSubCart(null, emptySubCart());
    }
  
    // 2. Then get user session asynchronously and load user cart if logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user || null;
      setUser(currentUser);

      if (isALaCarteSuccess()) {
        setCart([]);
        setShowCartPopup(false);
        localStorage.setItem('cart_guest', JSON.stringify([]));
        if (currentUser) {
          localStorage.setItem(`cart_${currentUser.id}`, JSON.stringify([]));
        }
        sessionStorage.removeItem('clear_cart_after_order');
        if (isSubSuccess()) wipeSubCart(currentUser);
        sessionStorage.removeItem('clear_sub_cart_after_subscribe');
        return;
      }

      if (isSubSuccess()) {
        wipeSubCart(currentUser);
        sessionStorage.removeItem('clear_sub_cart_after_subscribe');
        if (currentUser) adoptCartForUser(currentUser);
        return;
      }

      if (currentUser) {
        adoptCartForUser(currentUser);
        adoptSubCartForUser(currentUser);
      }
    });
  
    // 3. Listen to auth state changes (login/logout)
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user || null;
      setUser(currentUser);

      if (isALaCarteSuccess()) {
        setCart([]);
        setShowCartPopup(false);
        localStorage.setItem('cart_guest', JSON.stringify([]));
        if (currentUser) {
          localStorage.setItem(`cart_${currentUser.id}`, JSON.stringify([]));
        }
        sessionStorage.removeItem('clear_cart_after_order');
        if (isSubSuccess()) wipeSubCart(currentUser);
        sessionStorage.removeItem('clear_sub_cart_after_subscribe');
        return;
      }

      if (isSubSuccess()) {
        wipeSubCart(currentUser);
        sessionStorage.removeItem('clear_sub_cart_after_subscribe');
        if (currentUser) adoptCartForUser(currentUser);
        return;
      }
  
      if (currentUser) {
        adoptCartForUser(currentUser);
        adoptSubCartForUser(currentUser);
      } else {
        const parsedGuestCart = readStoredCart('cart_guest');
        setCart(parsedGuestCart);
        setShowCartPopup(parsedGuestCart.length > 0);
        const guestSub = readSubCart(null);
        setSubCart(guestSub);
        setShowSubCartPopup(totalQty(guestSub.meals) + totalQty(guestSub.addons) > 0);
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

  useEffect(() => {
    writeSubCart(user?.id || null, subCart);
  }, [subCart, user]);

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

  const addItemsToCart = (products = []) => {
    const list = Array.isArray(products) ? products.filter((item) => item?.id) : [];
    if (!list.length) return;
    setCart((prevCart) => mergeIntoCart(prevCart, list));
    setShowCartPopup(true);
  };

  const addToCart = (product, quantity = 1) => {
    addItemsToCart([{ ...product, quantity: Math.max(1, Number(quantity) || 1) }]);
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

  const bumpSubMeal = (product, delta) => {
    setSubCart((prev) => bumpMeal(prev, product, delta));
    setShowSubCartPopup(true);
  };

  const bumpSubAddon = (product, delta) => {
    setSubCart((prev) => bumpAddon(prev, product, delta));
    setShowSubCartPopup(true);
  };

  const clearSubCart = () => {
    wipeSubCart(user);
    sessionStorage.setItem('clear_sub_cart_after_subscribe', '1');
  };

  const clearCart = () => {
    setCart([]);
    setShowCartPopup(false);
    localStorage.setItem('cart_guest', JSON.stringify([]));
    if (user) {
      localStorage.setItem(`cart_${user.id}`, JSON.stringify([]));
    }
    sessionStorage.setItem('clear_cart_after_order', '1');
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
        clearSubCart={clearSubCart}
        subCart={subCart}
        setSubCart={setSubCart}
        bumpSubMeal={bumpSubMeal}
        bumpSubAddon={bumpSubAddon}
        showSubCartPopup={showSubCartPopup}
        setShowSubCartPopup={setShowSubCartPopup}
      />
      <Footer />
    </div>
  );
};

export default App;


