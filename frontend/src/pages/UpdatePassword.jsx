import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

const UpdatePassword = () => {
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

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

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      setMessage(`❌ ${error.message}`);
    } else {
      setMessage('✅ Password updated successfully!');
      setTimeout(() => navigate('/login'), 2000);
    }

    setLoading(false);
  };

  return (
    <div className="update-password page">
      <h1>Set a New Password</h1>
      <form onSubmit={handleSubmit}>
        <input
          type="password"
          placeholder="Enter new password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
        />
        <br /><br />
        <button type="submit" disabled={loading}>
          {loading ? 'Updating...' : 'Update Password'}
        </button>
      </form>
      {message && <p>{message}</p>}
    </div>
  );
};

export default UpdatePassword;
