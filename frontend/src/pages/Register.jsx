import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom'; 
import { Eye, EyeOff } from 'lucide-react';
import { supabase } from '../supabaseClient';
import loginImage from "../assets/images/accountImage.png"
import "../styles/Register.css"

const Register = ({setUser}) => {
  const [ email, setEmail ] = useState("");
  const [ password, setPassword ] = useState("");
  const [message, setMessage] = useState("");
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  
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
        body: JSON.stringify({ 
          email, 
          password, 
          first_name: firstName, 
          last_name: lastName, 
          phone_number: phoneNumber 
        }),
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

      <div className="register-form">
        <form onSubmit={handleRegisterSubmit}>
          <div className='register-form-name-container'>
            <div className='register-first-name-container'>
              <p className='register-text'>First Name</p>
              <input
                className='register-input'
                type="text"
                placeholder="FIRST NAME"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </div>
            
            <div className='register-last'>
              <p className='register-text'>Last Name</p>
              <input
                className='register-input'
                type="text"
                placeholder="LAST NAME"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>
          </div>

          <div className='register-email-number-container'>
            <div className='register-number-container'>
              <p className='register-text'>Phone Number</p>
                <input
                  className='register-input'
                  type="tel"
                  placeholder="XXX XXX XXXX"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  />
            </div>
            <div className='register-email-container'>
              <p className='register-text'>Email</p>
              <input
                className='register-input'
                type="email"
                placeholder="EMAIL"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                />
            </div>
          </div>

          <div className='register-password-container'>
            <div className='register-password'>
              <p className='register-text'>Password</p>
              <input
              className='register-input'
              type={showPassword ? 'text' : 'password'}
              placeholder="PASSWORD"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              />
            </div>

            <div className="register-confirm-password">
              <p className='register-text'>Confirm Password</p>
              <input
                className='register-input'
                type="password"
                placeholder="CONFIRM PASSWORD"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                />
            </div>

          </div>    

          {confirmPassword && (
            <p>
            {password === confirmPassword ? '' : ' Passwords do not match'}
            </p>
        )}

          <button
            className="login-submit-button"
            type="submit" 
            disabled={password !== confirmPassword}
          > Sign Up </button>
        </form>

          <p className='have-account-text'>ALREADY HAVE AN ACCOUNT?{' '}
            <Link 
            className="footer-account-register"
            to='/login'>SIGN IN</Link> 
          </p>
        
      </div>

      {/* Display success or error message */}
      {message && <p>{message}</p>}

      
      </div>
    </div>
  )
};

export default Register;
