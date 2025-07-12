import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom'; 


const Login = () => {

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [message, setMessage] = useState("");

  const navigate = useNavigate();

  const handleLoginSubmit = async (e) => {
    e.preventDefault();

    const res = await fetch('http://localhost:8080/login', {
      method: 'POST',
      // needs to specify content type when sending JSON with fetch or Axios
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

      // redirect after a short delay
      setTimeout(() => {
        navigate('/');
      }, 1500);
    }
  };

  return (
    <div className='login page'>
      <h1>Login Page!</h1>

      <form onSubmit={handleLoginSubmit}>
        <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required>

        </input>

        <br></br>

        <input 
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        />

        <br></br>
        <br></br>

        <button type="submit">Login</button>

      </form>
      <br></br>

      {message && <p>{message}</p>}

      <br></br>

      <div className='register section'>
        <p>Not a member yet? </p>
        
        <Link to='/register'>Sign up here</Link> 

      </div>
      
    </div>
  )
};

export default Login;