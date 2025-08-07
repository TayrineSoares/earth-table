import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom'; 
import { Eye, EyeOff } from 'lucide-react';
import { supabase } from '../supabaseClient';
import "../styles/Login.css"
import loginImage from "../assets/images/accountImage.png"


const Login = ({setUser}) => {

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);


  const navigate = useNavigate();

  const handleLoginSubmit = async (e) => {
    e.preventDefault();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      setMessage(`Login failed: ${error.message}`);
    } else {
      setUser(data.user);
      navigate(`/products/category`)
    }
  };

  return (
      <div className='login-page'>
      <div className="contact-header-image-container">
        <img
          className="contact-header-image"
          src={loginImage}
        />
      </div>

      <div className="page-wrapper">
        <div className="login-header">
          <p className="account-text">Account</p>
          <div className="login-header-footer">
            <Link to="/login" className="account-sign-in active">
              Sign In
            </Link>
            <Link className="account-register" to="/register">
              Create Account
            </Link>
          </div>
        </div>

        <div className="login-form-container">
          <form onSubmit={handleLoginSubmit}>
            <div className="login-details">
              <p className="login-detail-header-text">Email</p>
              <input
                className="login-detail-input-field"
                type="email"
                placeholder="EMAIL"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <br />

            <div className="login-details">
              <p className="login-detail-header-text">Password</p>
              <input
                className="login-detail-input-field"
                type={showPassword ? "text" : "password"}
                placeholder="PASSWORD"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onMouseDown={() => setShowPassword(true)}
                onMouseUp={() => setShowPassword(false)}
                onMouseLeave={() => setShowPassword(false)}
                tabIndex={-1}
                aria-label="Show password while holding"
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  marginLeft: "0.5rem",
                  color: "black",
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <br />
            <br />

            <button className="login-submit-button" type="submit">
              Login
            </button>
          </form>
        </div>
        <br />

        {message && <p>{message}</p>}

            <Link 
            className='forgot-password-text'
            to="/reset-password">Forgot password?</Link>
            
            <p className='dont-have-account'>Don't Have An Account?{' '}
              <Link className="footer-account-register" to="/register">
              Sign up
              </Link>
            </p>
        <br />
      </div>
    </div>
  );
};

export default Login;