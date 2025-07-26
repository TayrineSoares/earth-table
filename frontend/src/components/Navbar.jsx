import { Link, NavLink } from "react-router-dom";
import { useState } from "react";
import "../styles/NavBar.css";
import earthLogo from "../assets/images/earthLogo.png";
import earthLogoText from "../assets/images/earthLogoText.png";
import cartImage from "../assets/images/cartImage.png";

const Navbar = ({ user, onLogout }) => {
  const [showAccountMenu, setShowAccountMenu] = useState(false);

  const links = [
    { to: "/about", label: "ABOUT" },
    { to: "/products/category", label: "PRODUCTS" },
    { to: "/contact", label: "CONTACT" },
  ];

  const toggleMenu = () => setShowAccountMenu((prev) => !prev);
  const closeMenu = () => setShowAccountMenu(false);

  return (
    <nav>
      <div className="pager-wrapper">
        <div className="logo-header">
          <img
            src={earthLogo}
            className="earth-logo"
            alt="Earth Logo"
          />
          <Link to="/">
            <img
              src={earthLogoText}
              className="web-title"
              alt="Earth Table Co"
            />
          </Link>
        </div>

        <div className="nav-links-wrapper">
          <ul className="nav-links">
            {links.map((link) => (
              <li key={link.to}>
                <NavLink to={link.to} className="nav-link">
                  {link.label}
                </NavLink>
              </li>
            ))}

            <li className="account-menu-container">
              <div
                className="nav-link account-link"
                onClick={toggleMenu}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter") toggleMenu();
                }}
              >
                ACCOUNT
              </div>
              {showAccountMenu && (
                <ul className="account-dropdown-menu">
                  {!user && (
                    <>
                      <li>
                        <NavLink to="/login" className="dropdown-link" onClick={closeMenu}>
                          LOGIN
                        </NavLink>
                      </li>
                      <li>
                        <NavLink to="/register" className="dropdown-link" onClick={closeMenu}>
                          REGISTER
                        </NavLink>
                      </li>
                    </>
                  )}
                  {user && (
                    <>
                      <li>
                        <NavLink
                          to={`/profile/${user.id}`}
                          className="dropdown-link"
                          onClick={closeMenu}
                        >
                          PROFILE
                        </NavLink>
                      </li>
                      <li>
                        <NavLink
                          to="/orders"
                          className="dropdown-link"
                          onClick={closeMenu}
                        >
                          ORDER HISTORY
                        </NavLink>
                      </li>
                      <li>
                        <div
                          className="dropdown-link"
                          onClick={(e) => {
                            e.preventDefault();
                            closeMenu();
                            onLogout();
                          }}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              closeMenu();
                              onLogout();
                            }
                          }}
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

        <div className="cart-header">
          <Link to="/cart">
            <img
              src={cartImage}
              className="cart-image"
              alt="Cart"
            />
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
