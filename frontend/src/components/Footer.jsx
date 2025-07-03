import { Instagram } from 'lucide-react';
import '../styles/Footer.css';

const Footer = () => {
  return (
    <footer className="footer">
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

      <div className='footer-logo'>
        <span>Earth Table</span>

      </div>
      <div className="footer-info">
        
        <span>123 Fake street, Toronto, ON</span>
        <span>(555) 123-4567</span>
      </div>
     
    </footer>
  );
};

export default Footer;