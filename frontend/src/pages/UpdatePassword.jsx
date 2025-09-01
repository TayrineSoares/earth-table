import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Eye, EyeOff } from 'lucide-react';
import loginImage from "../assets/images/accountImage.png"

const UpdatePassword = () => {
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const [confirmPassword, setConfirmPassword] = useState('');

  // Capture session from URL token
  useEffect(() => {
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        console.log('Recovery session loaded:', session);
      }
    });
    return () => sub.subscription.unsubscribe(); 
  }, []);


  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    if (newPassword !== confirmPassword) {
      setMessage("Passwords do not match");
      setLoading(false); 
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      setMessage(`❌ ${error.message}`);
    } else {
      setMessage('Password updated successfully!');
      await supabase.auth.signOut();
      navigate('/login', { replace: true });
    }

    setLoading(false);
  };

  return (
    <div className="update-password page">
      <div className="contact-header-image-container">
        <img
          className="contact-header-image"
          src={loginImage}
        />
      </div>

      <div className='page-wrapper'>

        <div className="reset-password-header">
          <p className="password-text">Set New Password</p>
        </div>


        <h1 className='your-name-header'>Password</h1>
        <form onSubmit={handleSubmit}>
          <div className='password section'>
            <input
              className="login-detail-input-field" 
              type={showPassword ? 'text' : 'password'}
              placeholder="NEW PASSWORD"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
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
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                marginLeft: '0.1rem', 
                color: 'black',
              }}
              >
              {showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}
            </button>

            <div className="confirm-password section">
            <h1 className='your-name-header'>Confirm Password</h1>
              <input
                className="login-detail-input-field" 
                type="password"
                placeholder="CONFIRM PASSWORD"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                />
            </div>
          
          </div>
          <br></br>

          {confirmPassword && (
            <p>
              {newPassword === confirmPassword ? '' : ' Passwords do not match'}
            </p>
          )}
          
          <button className='contact-submit-button' type="submit" disabled={loading || newPassword !== confirmPassword}>
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      {message && <p>{message}</p>}
    </div>
  </div>
  );
};

export default UpdatePassword;
