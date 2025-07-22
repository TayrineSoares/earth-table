import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Eye, EyeOff } from 'lucide-react';

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
  }, []);


  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    if (newPassword !== confirmPassword) {
      setMessage("Passwords do not match");
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      setMessage(`❌ ${error.message}`);
    } else {
      setMessage('Password updated successfully!');
      setTimeout(() => navigate('/login'), 2000);
    }

    setLoading(false);
  };

  return (
    <div className="update-password page">
      <h1>Set a New Password</h1>
      
      <form onSubmit={handleSubmit}>
        <div className='password section'>
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Enter new password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
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

          <div className="confirm-password section">
            <input
              type="password"
              placeholder="Confirm Password"
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
        
        <button type="submit" disabled={loading || newPassword !== confirmPassword}>
          {loading ? 'Updating...' : 'Update Password'}
        </button>
      </form>
      {message && <p>{message}</p>}
    </div>
  );
};

export default UpdatePassword;
