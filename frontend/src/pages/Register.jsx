import { useState } from 'react';

const Register = () => {
  const [ email, setEmail ] = useState("");
  const [ password, setPassword ] = useState("");

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
    console.log(`You are registerd as ${data.user.email}`, data);  

  }

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

      
    </div>
  )
};

export default Register;
