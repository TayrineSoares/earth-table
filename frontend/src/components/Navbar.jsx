import { useState } from "react";
import { Link, NavLink } from "react-router-dom"
import '../styles/NavBar.css'

const Navbar = ({user, onLogout}) => {


  //links array to avoid code repetition
  const links = [
  { to: "/", label: "Home" },
  { to: "/about", label: "About" },
  { to: "/products", label: "Order" },
  { to: "/contact", label: "Contact Us" },
  { to: "/cart", label: "Cart" },
];

//state for mobile hamburger menu
const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav>
      
      <div className="logo"> 
        <Link to='/'> Earth Table</Link> 
      </div>

      {user && (
        <p>Welcome back, {user.email}!</p>
      )}

      <div 
        className="menu" 
        onClick={() =>{
          setMenuOpen(!menuOpen);
      }}>
        <span></span>
        <span></span>
        <span></span>
      </div>

      <ul className={menuOpen ? "open" : ""}>
        {links.map((link) => (
          <li key={link.to}>
            <NavLink
              to={link.to}
              className={({ isActive }) => (isActive ? "active" : undefined)}
            >
              {link.label}
            </NavLink>
            
          </li>
        ))}

        {/* Add Logout link if user is logged in */}
        {!user && (
          <li>
            <NavLink
              to="/login"
              className={({ isActive }) => (isActive ? "active" : undefined)}
            >
              Login
            </NavLink>
          </li>
        )}
        {user && (
          <li>
            <Link
              to="#"
              
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
    </nav>
  );
};

export default Navbar;
