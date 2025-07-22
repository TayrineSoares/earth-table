import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom'; 
import { Eye, EyeOff } from 'lucide-react';

const Register = ({setUser}) => {
  const [ email, setEmail ] = useState("");
  const [ password, setPassword ] = useState("");

  const [message, setMessage] = useState("");
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);

    const [showPassword, setShowPassword] = useState(false);
  
  const navigate = useNavigate();

  const handleLogin = async () => {
    try {

      const res = await fetch('http://localhost:8080/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({email, password})
      });
      const data = await res.json();

      if (data.error) {
        setMessage(`Login failed: ${data.error}`);
      } else {
        setMessage(`You are logged in as ${data.user.email}`);
        console.log(`User logged in as ${data.user.email}`, data);

        // Save token in localStorage
        localStorage.setItem('token', data.session.access_token);
        // Save user info
        localStorage.setItem('user', JSON.stringify(data.user)); 
        setUser(data.user);
      
        setTimeout(() => {
          navigate(`/profile/${data.user.id}`);
        }, 1500);
      }

    } catch (error) {
      setMessage("Login error:" + error.message);
    }
  };



  const handleRegisterSubmit = async (e) => {
    e.preventDefault();

    try {
      const res = await fetch ('http://localhost:8080/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({email, password})
      });

      const data = await res.json();

      if (data.error) {
        setMessage(`Registration failed: ${data.error}`);
        if (data.error === "User already registered") {
          setAlreadyRegistered(true);
        } else {
          setAlreadyRegistered(false)
        }

      } else {
        setMessage(`You have been registered as ${data.user.email}`);
        setAlreadyRegistered(false);
        console.log(`User registered as ${data.user.email}`, data);

        //proceed to automatic login
        handleLogin();
        
      }
    } catch (error) {
      setMessage("Registration error:" + error.message);
    }

  };

  return (
    <div className="register page">
      <h1>Register page </h1>

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
          
          <br></br>

          <button type="submit"> Register </button>
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
  )
};

export default Register;
