const Register = () => {

  const handleRegisterSubmit = async (e) => {
    e.preventDefault(); 

  }


  return (
    <div className="register page">
      <h1>Register here! </h1>

      <div className="register form">
        <form onSubmit={handleRegisterSubmit}>
          <input
            type="email"
            placeholder="Email"

            
          />
          <br></br>

          <input
            type="password"
            placeholder="Password"
          
          />

        </form>

      </div>

      
    </div>
  )
};

export default Register;
