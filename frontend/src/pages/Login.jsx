import { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { supabase } from '../supabaseClient';
import FeedbackDialog from '../components/FeedbackDialog';
import "../styles/Login.css"
import loginImage from "../assets/images/accountImage.png"

const Login = ({setUser}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [dialog, setDialog] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  const navigate = useNavigate();
  const closeDialog = useCallback(() => setDialog(null), []);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      const isInvalid = /invalid login credentials/i.test(error.message);
      const isUnconfirmed = /email not confirmed/i.test(error.message);

      if (isUnconfirmed) {
        setDialog({
          icon: 'mail',
          title: 'Check your email',
          body: 'Please confirm your account from the email we sent before signing in.',
          hint: "Don't see it? Check spam, or try registering again.",
          primaryLabel: 'Got it',
        });
        return;
      }

      setDialog({
        icon: 'alert',
        title: 'Login failed',
        body: isInvalid ? 'Invalid login credentials.' : error.message,
        hint: isInvalid
          ? 'Check your email and password, or reset your password if you forgot it.'
          : undefined,
        primaryLabel: 'Got it',
        secondaryLabel: isInvalid ? 'Forgot password?' : undefined,
        secondaryTo: isInvalid ? '/reset-password' : undefined,
      });
      return;
    }

    setUser(data.user);
    navigate(`/`);
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
                className='see-password'
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

            <Link
            className='forgot-password-text'
            to="/reset-password">FORGOT PASSWORD?</Link>

            <p className='dont-have-account'>DON'T HAVE AN ACCOUNT? {' '}
              <Link className="footer-account-register" to="/register">
              SIGN UP
              </Link>
            </p>
        <br />
      </div>

      <FeedbackDialog dialog={dialog} onClose={closeDialog} />
    </div>
  );
};

export default Login;
