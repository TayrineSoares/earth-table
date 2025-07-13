import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom'; 

const Register = () => {
  const [ email, setEmail ] = useState("");
  const [ password, setPassword ] = useState("");

  const [message, setMessage] = useState("");
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  
  const navigate = useNavigate();

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();

    const res = await fetch ('http://localhost:8080/register', {
      method: 'POST',
      // needs to specify content type when sending JSON with fetch or Axios
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

      // Wait before redirecting to login page
      setTimeout(() => {
        navigate('/login');
      }, 1500);
      
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

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <br></br>

          <button type="submit"> Register </button>
        </form>

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
