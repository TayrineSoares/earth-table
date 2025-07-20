import { useState } from "react";

const ResetPassword = () => {
  const [ email, setEmail ] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("Reset Password for", email);
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
