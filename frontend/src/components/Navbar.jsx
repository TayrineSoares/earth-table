import { NavLink } from "react-router-dom"

const Navbar = () => {
  return (
    <nav>
      <ul className="open">
        <li>
          <NavLink to='/'> Home </NavLink>
        </li>
        <li>
          <NavLink to='/about'> About </NavLink>
        </li>
        <li>
          <NavLink to='/products'> Order </NavLink>
        </li>
        <li>
          <NavLink to='/contact'> Contact Us </NavLink>
        </li>
        <li>
          <NavLink to='/cart'> Cart </NavLink>
        </li>
        <li>
          <NavLink to='/login'> Login </NavLink>
        </li>
      </ul>



    </nav>
  )
};

export default Navbar;
