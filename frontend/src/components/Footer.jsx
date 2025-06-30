import { Instagram } from 'lucide-react';
import '../styles/Footer.css';

const Footer = () => {
  return (
    <footer className="footer">
      <div className="footer-info">
        <span>Earth Table</span>
        <span>123 Fake street, Toronto, ON</span>
        <span>(555) 123-4567</span>
      </div>
      <div className="social-icons">
        <a 
          href="https://www.instagram.com/earthtable_co/" 
        >
          <Instagram size={25} />
        </a>
      </div>
    </footer>
  );
};

export default Footer;