import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom'; 


const Login = () => {

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

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
    console.log(`You are logged in as ${data.user.email}`,  data);
  }

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

      <div className='register section'>
        <p>Not a member yet? </p>
        
        <Link to='/register'>Sign up here</Link> 

      </div>
      
    </div>
  )
};

export default Login;