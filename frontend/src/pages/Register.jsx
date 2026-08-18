import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CircleAlert, LogIn, Mail } from 'lucide-react';
import loginImage from "../assets/images/accountImage.png"
import "../styles/Register.css"

const DIALOG_ICONS = {
  mail: Mail,
  login: LogIn,
  alert: CircleAlert,
};

const BANNER_COPY = {
  confirmEmail: {
    title: 'Check your email to confirm your account.',
    text: (
      <>
        Don&apos;t see it? You may already be registered —{' '}
        <Link className="footer-account-register" to="/login">try logging in</Link>.
      </>
    ),
  },
  alreadyRegistered: {
    title: 'This email is already registered.',
    text: (
      <>
        <Link className="footer-account-register" to="/login">Log in</Link> to continue.
      </>
    ),
  },
};

function DialogAction({ to, className, onClick, children }) {
  if (to) return <Link className={className} to={to}>{children}</Link>;
  return (
    <button type="button" className={className} onClick={onClick}>
      {children}
    </button>
  );
}

const Register = ({setUser}) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [dialog, setDialog] = useState(null);
  const [banner, setBanner] = useState(null);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneError, setPhoneError] = useState("");
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);

  const navigate = useNavigate();
  const passwordsMismatch = Boolean(confirmPassword) && password !== confirmPassword;
  const closeDialog = () => setDialog(null);
  const openErrorDialog = (title, body) => setDialog({
    type: 'error',
    icon: 'alert',
    title,
    body,
    primaryLabel: 'Got it',
  });

  useEffect(() => {
    if (!dialog) return;

    const onKeyDown = (e) => {
      if (e.key === 'Escape') setDialog(null);
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [dialog]);

  const formatPhoneForInput = (value) => {
    const cleaned = (value || "").replace(/\D/g, "").slice(0, 10);
    if (cleaned.length < 4) return cleaned;
    if (cleaned.length < 7) return `(${cleaned.slice(0,3)}) ${cleaned.slice(3)}`;
    return `(${cleaned.slice(0,3)}) ${cleaned.slice(3,6)}-${cleaned.slice(6)}`;
  };

  const handlePhoneTyping = (e) => {
    const digitsOnly = e.target.value.replace(/\D/g, "").slice(0, 10);
    setPhoneNumber(digitsOnly);
    setPhoneError(digitsOnly && digitsOnly.length !== 10 ? "Phone number must be 10 digits." : "");
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();

    if (phoneNumber.replace(/\D/g, "").length !== 10) {
      openErrorDialog('Check your phone number', 'Please enter a 10-digit phone number.');
      return;
    }

    if (password !== confirmPassword) {
      openErrorDialog('Passwords do not match', 'Please make sure both password fields are the same, then try again.');
      return;
    }

    if (!agreedToPrivacy) {
      openErrorDialog('Privacy Policy', 'Please agree to the Privacy Policy to create an account.');
      return;
    }

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        const isAlready = data?.already_registered || /already|exists/i.test(errMsg);

        if (isAlready) {
          setBanner('alreadyRegistered');
          setDialog({
            type: 'alreadyRegistered',
            icon: 'login',
            title: 'Already registered',
            body: 'This email is already registered. Log in to continue.',
            hint: 'If you forgot your password, you can reset it from the sign-in page.',
            primaryLabel: 'Log in',
            primaryTo: '/login',
            secondaryLabel: 'Got it',
          });
          return;
        }

        setBanner(null);
        openErrorDialog('Registration failed', errMsg);
        return;
      }

      if (data?.needs_confirmation) {
        localStorage.setItem('pendingProfile', JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          phone_number: phoneNumber
        }));
        setBanner('confirmEmail');
        setDialog({
          type: 'confirmEmail',
          icon: 'mail',
          title: 'Check your email',
          body: `We sent a confirmation link to ${email}. Open it to finish creating your account.`,
          hint: "Don't see it? Check spam, or you may already be registered — try logging in instead.",
          primaryLabel: 'Got it',
          secondaryLabel: 'Sign in',
          secondaryTo: '/login',
        });
        return;
      }

      if (data?.user) {
        setBanner(null);
        setUser(data.user);
        setDialog({
          type: 'success',
          icon: 'mail',
          title: 'You are registered',
          body: `You have been registered as ${data.user.email}.`,
          primaryLabel: 'Continue',
        });
        setTimeout(() => navigate('/'), 1500);
      }
    } catch (err) {
      setBanner(null);
      openErrorDialog('Registration error', err.message);
    }
  };

  const DialogIcon = dialog ? DIALOG_ICONS[dialog.icon] || CircleAlert : null;
  const bannerCopy = banner && dialog?.type !== banner ? BANNER_COPY[banner] : null;

  return (
    <div className="register page">
      <div className="contact-header-image-container">
        <img className="contact-header-image" src={loginImage} />
      </div>

      <div className="page-wrapper">
        <div className="login-header">
          <p className="account-text">Account</p>
          <div className="login-header-footer">
            <Link to="/login" className="account-sign-in">Sign In</Link>
            <Link className="account-register active" to="/register">Create Account</Link>
          </div>
        </div>

        <div className="register-form">
          {bannerCopy && (
            <div className="register-confirm-banner" role="status">
              <p className="register-confirm-banner-title">{bannerCopy.title}</p>
              <p className="register-confirm-banner-text">{bannerCopy.text}</p>
            </div>
          )}

          <form onSubmit={handleRegisterSubmit}>
            <div className="register-form-name-container">
              <div className="register-first-name-container">
                <p className="register-text">First Name</p>
                <input
                  className="register-input"
                  type="text"
                  placeholder="FIRST NAME"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </div>

              <div className="register-last">
                <p className="register-text">Last Name</p>
                <input
                  className="register-input"
                  type="text"
                  placeholder="LAST NAME"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="register-email-number-container">
              <div className="register-number-container">
                <p className="register-text">Phone Number</p>
                <input
                  className={`register-input${phoneError ? ' register-input-error' : ''}`}
                  type="tel"
                  placeholder="(XXX) XXX-XXXX"
                  inputMode="numeric"
                  autoComplete="tel"
                  value={formatPhoneForInput(phoneNumber)}
                  onChange={handlePhoneTyping}
                  required
                />
                {phoneError && (
                  <p className="register-field-error" role="alert">{phoneError}</p>
                )}
              </div>
              <div className="register-email-container">
                <p className="register-text">Email</p>
                <input
                  className="register-input"
                  type="email"
                  placeholder="EMAIL"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="register-password-container">
              <div className="register-password">
                <p className="register-text">Password</p>
                <input
                  className={`register-input${passwordsMismatch ? ' register-input-error' : ''}`}
                  type="password"
                  placeholder="PASSWORD"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <div className="register-confirm-password">
                <p className="register-text">Confirm Password</p>
                <input
                  className={`register-input${passwordsMismatch ? ' register-input-error' : ''}`}
                  type="password"
                  placeholder="CONFIRM PASSWORD"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            {passwordsMismatch && (
              <p className="register-password-mismatch" role="alert">
                Passwords do not match
              </p>
            )}

            <div className="general-text">
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
              disabled={!agreedToPrivacy}
            >
              Sign Up
            </button>
          </form>

          <p className="have-account-text">
            ALREADY HAVE AN ACCOUNT?{' '}
            <Link className="footer-account-register" to="/login">SIGN IN</Link>
          </p>
        </div>
      </div>

      {dialog && (
        <div
          className="register-dialog-overlay"
          role="presentation"
          onClick={closeDialog}
        >
          <div
            className="register-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="register-dialog-title"
            aria-describedby="register-dialog-body"
            onClick={(e) => e.stopPropagation()}
          >
            {DialogIcon && <DialogIcon className="register-dialog-icon" aria-hidden="true" />}
            <h2 id="register-dialog-title" className="register-dialog-title">
              {dialog.title}
            </h2>
            <p id="register-dialog-body" className="register-dialog-body">
              {dialog.body}
            </p>
            {dialog.hint && (
              <p className="register-dialog-hint">{dialog.hint}</p>
            )}
            <div className="register-dialog-actions">
              <DialogAction
                className="register-dialog-primary"
                to={dialog.primaryTo}
                onClick={closeDialog}
              >
                {dialog.primaryLabel}
              </DialogAction>
              {dialog.secondaryLabel && (
                <DialogAction
                  className="register-dialog-secondary"
                  to={dialog.secondaryTo}
                  onClick={closeDialog}
                >
                  {dialog.secondaryLabel}
                </DialogAction>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Register;
