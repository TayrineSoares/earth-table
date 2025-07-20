
const UpdatePassword = () => {
  return (
    <div className="update-password page">
      <h1>Set a New Password</h1>

      <form>
        <input 
          type="password"
          placeholder="Enter new password"
        
        />
        <br></br>
        <br></br>
        <button type="submit">Update password</button>
      </form>
      
    </div>
  );
};

export default UpdatePassword;
