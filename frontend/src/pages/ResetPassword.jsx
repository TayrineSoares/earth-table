import { useState } from "react";

const ResetPassword = () => {
  const [ email, setEmail ] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const res = await fetch('http://localhost:8080/login/reset-password', {
        method: 'POST', 
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (res.ok) {
        alert(' Reset email sent. Check your inbox!');
      } else {
        alert(`❌ ${data.error}`);
      }
    } catch (err) {
      alert('❌ Something went wrong.');
      console.error(err);

    }
  }

  return (
    <div className="reset-password page">
      <h1>Reset password page</h1>
      <form onSubmit={handleSubmit}>
        <input 
        type="email"
        placeholder="Enter your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
          
        />
        <br></br>
        <br></br>
        <button type="submit">Send reset Link </button>
      </form>

    </div>
  )
};

export default ResetPassword;
