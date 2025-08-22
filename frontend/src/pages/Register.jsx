import { useState, use } from 'react';
import { Link, useNavigate } from 'react-router-dom'; 
import loginImage from "../assets/images/accountImage.png"
import "../styles/Register.css"

const Register = ({setUser}) => {
  const [ email, setEmail ] = useState("");
  const [ password, setPassword ] = useState("");
  const [message, setMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneError, setPhoneError] = useState("");
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);
  
  const navigate = useNavigate();

  // show (123) 456-7890 in the input
  const formatPhoneForInput = (value) => {
    const cleaned = (value || "").replace(/\D/g, "").slice(0, 10);
    if (cleaned.length < 4) return cleaned;
    if (cleaned.length < 7) return `(${cleaned.slice(0,3)}) ${cleaned.slice(3)}`;
    return `(${cleaned.slice(0,3)}) ${cleaned.slice(3,6)}-${cleaned.slice(6)}`;
  };

  // write only digits to state
  const handlePhoneTyping = (e) => {
    const digitsOnly = e.target.value.replace(/\D/g, "").slice(0, 10);
    setPhoneNumber(digitsOnly);
    if (digitsOnly && digitsOnly.length !== 10) {
      setPhoneError("Phone number must be 10 digits.");
    } else {
      setPhoneError("");
    }
  };
  
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();

    if (phoneNumber && phoneNumber.replace(/\D/g, "").length !== 10) {
      setMessage("Please enter a 10-digit phone number.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match");
      return;
    }
    if (!agreedToPrivacy) {
      setMessage("Please agree to the Privacy Policy.");
      return;
    }

    try {
      const res = await fetch('/api/register', {
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

      const text = await res.text();
      const data = text ? JSON.parse(text) : null;

      if (!res.ok) {
        const errMsg = data?.error || `HTTP ${res.status}`;
        setMessage(`Registration failed: ${errMsg}`);
        setAlreadyRegistered(/already/i.test(errMsg));
        return;
      }

      // Expect 202 + needs_confirmation: true
      if (data?.needs_confirmation) {
        // stash non-sensitive profile bits for after confirmation
        localStorage.setItem('pendingProfile', JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          phone_number: phoneNumber
        }));
        setMessage("Check your email to confirm your account, then you’ll be signed in.");
        setAlreadyRegistered(false);
        return;
      }

      // (If confirmations are OFF, backend may return user/session)
      if (data?.user) {
        setMessage(`You have been registered as ${data.user.email}`);
        setAlreadyRegistered(false);
        setUser(data.user);
        setTimeout(() => navigate('/'), 1500);
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
                  placeholder="(XXX) XXX-XXXX"
                  inputMode="numeric"
                  autoComplete="tel"
                  value={formatPhoneForInput(phoneNumber)}
                  onChange={handlePhoneTyping}
                  required
                />
                {phoneError}
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

            <div className='general-text'>
              <input
                type="checkbox"
                id="privacy-agree"
                checked={agreedToPrivacy}
                onChange={(e) => setAgreedToPrivacy(e.target.checked)}
              />
              <label htmlFor="privacy-agree">
                I have read and agree to the <Link className="footer-account-register" to="/privacy">Privacy Policy</Link>.
              </label>
            </div>

          <button
            className="login-submit-button"
            type="submit" 
            disabled={password !== confirmPassword || !agreedToPrivacy}
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
