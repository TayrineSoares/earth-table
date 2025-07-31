import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom'; 
import { Eye, EyeOff } from 'lucide-react';
import { supabase } from '../supabaseClient';
import loginImage from "../assets/images/accountImage.png"

const Register = ({setUser}) => {
  const [ email, setEmail ] = useState("");
  const [ password, setPassword ] = useState("");
  const [message, setMessage] = useState("");
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const navigate = useNavigate();

  
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setMessage("Passwords do not match");
      return;
    }

    try {
      const res = await fetch('http://localhost:8080/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (data.error) {
        setMessage(`Registration failed: ${data.error}`);
        if (data.error.includes("already registered")) {
          setAlreadyRegistered(true);
        } else {
          setAlreadyRegistered(false);
        }
      } else {
        setMessage(`You have been registered as ${data.user.email}`);
        setAlreadyRegistered(false);
        setUser(data.user);

        // Supabase already created session ; Navbar will update automatically
        setTimeout(() => {
          navigate(`/profile/${data.user.id}`);
        }, 1500);
      }

    } catch (err) {
      setMessage("Registration error: " + err.message);
    }
  };

  return (
    <div className="register page">
      <div className="contact-header-image-container">
        <img
          className="contact-header-image"
          src={loginImage}
        />
      </div>
    
    <div className='page-wrapper'>
      <div className="login-header">
        <p className="account-text">Account</p>
        <div className="login-header-footer">
            <Link to="/login" className="account-sign-in">
              Sign In
            </Link>
            <Link className="account-register active" to="/register">
              Create Account
            </Link>
        </div>
      </div>

      <div className="register form">
        <form onSubmit={handleRegisterSubmit}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            />
          
          <br></br>

          <div className='password section'>
            <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            />

            <button 
            type="button" 
            onMouseDown={() => setShowPassword(true)}
            onMouseUp={() => setShowPassword(false)}
            onMouseLeave={() => setShowPassword(false)}
            tabIndex={-1} // skip this element when tabbing with the keyboard
            aria-label="Show password while holding"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              marginLeft: '0.1rem', 
              color: 'black',
            }}
            >
            {showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}
            </button>

          </div>

          <div className="confirm-password section">
            <input
              type="password"
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              />
          </div>
                    
          <br></br>

          {confirmPassword && (
            <p>
            {password === confirmPassword ? '' : ' Passwords do not match'}
          </p>
        )}

          <button type="submit" disabled={password !== confirmPassword}> Register </button>
        </form>

        
        <br></br>
        
        <Link to='/'>Back to Home Page</Link> 


      </div>

      {/* Display success or error message */}
      {message && <p>{message}</p>}

      {alreadyRegistered && (
        
      <div className='register section'>
        <p>Already Registered? </p>
        <Link to='/login'>Login here</Link> 
      </div>
      )}
      
      </div>
    </div>
  )
};

export default Register;
