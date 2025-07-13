import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom'; 

const Login = ({setUser}) => {

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

      // Save token in localStorage
      //setItem is a built-in browser method for storing data in your web browser
      // browsers give every website a little place to store data called localStorage.
      localStorage.setItem('token', data.session.access_token);

      // Save user info
      localStorage.setItem('user', JSON.stringify(data.user)); 

      setUser(data.user);
      

      // // for debuging
      // const token = localStorage.getItem('token');
      // console.log('Token:', token);

      // // Get user (parse because it's stored as a string)
      // const user = JSON.parse(localStorage.getItem('user'));
      // console.log('User:', user);
      // console.log('User email:', user.email);

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
        required
        />

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