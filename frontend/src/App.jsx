import './App.css'
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
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


const App = () => {

  return (
    <BrowserRouter>

      <Navbar />
      <div className='main'>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/products" element={<Products />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/login" element={<Login />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/confirmation" element={<Confirmation />} />
          <Route path="/admin" element={<Admin />} />

        </Routes>
      </div>
      <Footer />
    </BrowserRouter>
  );
}

export default App;