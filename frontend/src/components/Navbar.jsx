import { Link, NavLink } from "react-router-dom";
import "../styles/NavBar.css";
import earthLogo from "../assets/images/earthLogo.png";
import earthLogoText from "../assets/images/earthLogoText.png";
import cartImage from "../assets/images/cartImage.png"

const Navbar = ({ user, onLogout }) => {
  const links = [
    { to: "/about", label: "ABOUT" },
    { to: "/products", label: "PRODUCTS" },
    { to: "/contact", label: "CONTACT" },
  ];

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

        {user && (
          <p className="welcome-message">Welcome back, {user.email}!</p>
          )}

        <div className="nav-links-wrapper">
          <ul className="nav-links">
            {links.map((link) => (
              <li key={link.to}>
                <NavLink to={link.to} className="nav-link">
                  {link.label}
                </NavLink>
              </li>
            ))}

            {user?.id && (
              <li>
                <NavLink to={`/profile/${user.id}`} className="nav-link">
                  Profile
                </NavLink>
              </li>
            )}

            {!user && (
              <li>
                <NavLink to="/login" className="nav-link">
                  ACCOUNT
                </NavLink>
              </li>
            )}

            {user && (
              <li>
                <Link
                  to="#"
                  className="nav-link"
                  onClick={(e) => {
                    e.preventDefault();
                    onLogout();
                  }}
                  >
                  Logout
                </Link>
              </li>
            )}
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
