import { Facebook, Instagram } from "lucide-react";
import { Link } from "react-router-dom";
import "../styles/Footer.css";
import blackLogo from "../assets/images/blackLogo.png";

const navLinks = [
  { to: "/subscribe-and-save", label: "Subscribe & Save" },
  { to: "/products/category", label: "Menu" },
  { to: "/products/category/28", label: "Custom meals" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
];

const Footer = () => {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-main">
          <Link to="/" className="footer-lockup" aria-label="Earth Table Co home">
            <img src={blackLogo} className="footer-earth-logo" alt="" />
            <span className="footer-web-title">EARTH TABLE CO</span>
          </Link>

          <nav className="footer-nav" aria-label="Footer">
            {navLinks.map((link) => (
              <Link key={link.to} to={link.to} className="footer-nav-link">
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="footer-meta">
            <div className="footer-contact">
              <a className="footer-contact-link" href="tel:+16478029248">
                (647) 802-9248
              </a>
              <p className="footer-address">77 Woodstream Blvd, Vaughan, ON</p>
            </div>

            <div className="footer-social">
              <a
                className="footer-social-link"
                href="https://www.instagram.com/earthtable_co/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Visit Earth Table on Instagram"
              >
                <span className="footer-social-icon">
                  <Instagram size={18} aria-hidden="true" />
                </span>
              </a>
              <a
                className="footer-social-link"
                href="https://www.facebook.com/share/1cGrw7myiF/?mibextid=wwXIfr"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Visit Earth Table on Facebook"
              >
                <span className="footer-social-icon">
                  <Facebook size={18} aria-hidden="true" />
                </span>
              </a>
            </div>
          </div>
        </div>

        <div className="footer-legal">
          <p className="footer-copyright">© 2026 Earth Table Co</p>
          <Link to="/privacy" className="footer-legal-link">
            Privacy Policy &amp; Terms
          </Link>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
