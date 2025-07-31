import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom'; 
import { Eye, EyeOff } from 'lucide-react';
import { supabase } from '../supabaseClient';


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
      setMessage(`You are logged in as ${data.user.email}`);
      console.log(`User logged in as ${data.user.email}`, data);

      setUser(data.user);

      setTimeout(() => {
        navigate(`/profile/${data.user.id}`);
      }, 1500);
    }
  };

  return (
    <div className='login page'>
      <h1>Login </h1>

      <form onSubmit={handleLoginSubmit}>
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

        <br></br>
        <br></br>

        <button type="submit">Login</button>

      </form>
      <br></br>

      {message && <p>{message}</p>}


      <div className='forgot-password section'>
        <p>
          <Link to='/reset-password'>Forgot password</Link> 
        </p>

      </div>
      <br></br>

      <div className='register section'>
        <p>Not a member yet? </p>
        
        <Link to='/register'>Sign up here</Link> 
      </div>

      
      
    </div>
  )
};

export default Login;