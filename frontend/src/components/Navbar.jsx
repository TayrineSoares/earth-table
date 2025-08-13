import { Link, NavLink } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import { fetchUserByAuthId } from "../helpers/adminHelpers";
import "../styles/NavBar.css";

import earthLogo from "../assets/images/earthLogo.png";
import earthLogoText from "../assets/images/earthLogoText.png";
import cartImage from "../assets/images/cartImage.png";

const Navbar = ({ user, onLogout }) => {
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const accountMenuRef = useRef(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const links = [
    { to: "/about", label: "ABOUT" },
    { to: "/products/category", label: "PRODUCTS" },
    { to: "/contact", label: "CONTACT" },
  ];

  const toggleMenu = () => setShowAccountMenu((prev) => !prev);
  const closeMenu = () => setShowAccountMenu(false);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target)) {
        closeMenu();
      }
    };
    if (showAccountMenu) document.addEventListener("mousedown", handleClickOutside);
    else document.removeEventListener("mousedown", handleClickOutside);

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showAccountMenu]);

  useEffect(() => {
    if (!user) return;

    const checkAdmin = async () => {
      try {
        const userInfo = await fetchUserByAuthId(user.id);
        setIsAdmin(userInfo.is_admin || false);
      } catch (err) {
        console.error("Error checking admin status", err);
      }
    };
    checkAdmin();
  }, [user]);

  return (
    <nav>

      <div className="hamburger-menu" onClick={() => setIsMobileMenuOpen(prev => !prev)}>
        <div className="bar"></div>
        <div className="bar"></div>
        <div className="bar"></div>
      </div>
      
        {/* Logo */}
        <div className="logo-header">
          <img src={earthLogo} className="earth-logo" alt="Earth Logo" />
          <Link to="/">
            <img src={earthLogoText} className="web-title" alt="Earth Table Co" />
          </Link>
          
          {/* Hamburger menu button (small phones) */}
        </div>

        {/* Nav links */}
        <div className={`nav-links-wrapper ${isMobileMenuOpen ? "open" : ""}`}>
          <ul className="nav-links">
            {links.map((link) => (
              <li key={link.to}>
                <NavLink to={link.to} className="nav-link" onClick={() => setIsMobileMenuOpen(false)}>
                  {link.label}
                </NavLink>
              </li>
            ))}

            <li className="account-menu-container" ref={accountMenuRef}>
              <div
                className="nav-link account-link"
                onClick={toggleMenu}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter") toggleMenu(); }}
              >
                ACCOUNT
              </div>
              {showAccountMenu && (
                <ul className="account-dropdown-menu">
                  {!user && (
                    <li>
                      <NavLink to="/login" className="dropdown-link" onClick={closeMenu}>
                        LOGIN/REGISTER
                      </NavLink>
                    </li>
                  )}
                  {user && (
                    <>
                      <li>
                        <NavLink to={`/profile/${user.id}`} className="dropdown-link" onClick={closeMenu}>
                          PROFILE
                        </NavLink>
                      </li>
                      <li>
                        <NavLink to={`/orders/${user.id}`} className="dropdown-link" onClick={closeMenu}>
                          ORDER HISTORY
                        </NavLink>
                      </li>
                      {isAdmin && (
                        <li>
                          <NavLink to="/admin" className="dropdown-link" onClick={closeMenu}>
                            ADMIN BOARD
                          </NavLink>
                        </li>
                      )}
                      <li>
                        <div
                          className="dropdown-link"
                          onClick={(e) => { e.preventDefault(); closeMenu(); onLogout(); }}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => { if (e.key === "Enter") { closeMenu(); onLogout(); } }}
                        >
                          LOGOUT
                        </div>
                      </li>
                    </>
                  )}
                </ul>
              )}
            </li>
          </ul>
        </div>

        {/* Cart */}
        <div className="cart-header">
          <Link to="/cart">
            <img src={cartImage} className="cart-image" alt="Cart" />
          </Link>
        </div>
    </nav>
  );
};

export default Navbar;
