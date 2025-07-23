import { Instagram } from 'lucide-react';
import { Link } from "react-router-dom";
import '../styles/Footer.css';
import logoNoBackground from "../assets/images/logoNoBackground.png";
import blackLogo from "../assets/images/blackLogo.png";

const Footer = () => {
  return (
    <footer className="footer">
      <div className="logo-footer">
          <img
            src={blackLogo}
            className="footer-earth-logo"
            alt="Earth Logo"
          />
          <Link to="/">
            <p
              className="footer-web-title"
            >EARTH TABLE CO</p>
          </Link>
      </div>

      <div className='copyright-contatiner'>
        <p className='copyright'>© 2025 EARTH TABLE CO</p>
      </div>


        <div className='footer-number-container'>
          <p className='footer-number'>(555) 123-4567</p>
        </div>
        
        <div className='footer-address-container'>
          <p className='footer-address'>123 Fake street, Toronto, ON</p>
        </div>

      <div className="social-icons">
        <a 
          href="https://www.instagram.com/earthtable_co/"
          target="_blank" 
          rel="noopener noreferrer"
          aria-label="Visit Earth Table on Instagram"
        >
          <Instagram size={25} />
        </a>
      </div>
     
    </footer>
  );
};

export default Footer;