import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

const Profile = () => {

  const { auth_user_id } = useParams(); //get the ID from the URL
  const [ user, setUser ] = useState(null); 
  const [ error, setError ] = useState("");
  const [message, setMessage] = useState("");

  //console.log("this is my auth user id" , auth_user_id);

  useEffect (() => { 
    const fetchUser = async () => {
      try {
        const res = await fetch(`http://localhost:8080/users/${auth_user_id}`);
        const data = await res.json();

        if (res.ok) {
          setUser(data);
        } else {
          setError(data.error || "Failed to fetch user.");
        }
      } catch (err) {
        setError(`Server error: ${err.message}`);
      }
    };

    fetchUser();

  }, [auth_user_id]);

  const handleChange = (e) => {
    setUser({...user, [e.target.name]: e.target.value});
  };

  const handleUpdate = async (e) =>{
    e.preventDefault(); 
    setMessage("");

    try {
      const res = await fetch (`http://localhost:8080/users/${auth_user_id}`, {
        method: "PATCH", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: user.first_name,
          last_name: user.last_name,
          country: user.country,
          phone_number: user.phone_number
        })
      });

      const data = await res.json();
      if (res.ok) {
        setMessage("Profile updated successfully!");
        setUser(data); //Update UI
      } else {
        setError(data.error || "Failed to update profile.");
      }
    } catch (err) {
      setError(`Server error: ${err.message}`);
    }
  };
  

  if (error) return <p>{error}</p>;
  if (!user) return <p>Loading...</p>;

  return (
    <div>
      <h1>Profile</h1>

      <form onSubmit={handleUpdate}>
        <label>Email:</label>
        <input name="email" value={user.email} disabled /><br />

        <label>First Name:</label>
        <input name="first_name" value={user.first_name || ""} onChange={handleChange} /><br />

        <label>Last Name:</label>
        <input name="last_name" value={user.last_name || ""} onChange={handleChange} /><br />

        <label>Country:</label>
        <input name="country" value={user.country || ""} onChange={handleChange} /><br />

        <label>Phone Number:</label>
        <input name="phone_number" value={user.phone_number || ""} onChange={handleChange} /><br />

        <button type="submit">Update Profile</button>


      </form>

      
    </div>
  )
};

export default Profile;
