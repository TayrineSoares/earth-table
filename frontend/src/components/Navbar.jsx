import { Link } from "react-router-dom"

const Navbar = () => {
  return (
    <div>
      <h1>Testing link <Link to='/about'>About Page </Link></h1>
    </div>
  )
};

export default Navbar;
