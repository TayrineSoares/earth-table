import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

const Profile = () => {

  const { auth_user_id } = useParams(); //get the ID from the URL
  const [ user, setUser ] = useState(null); 
  const [ error, setError ] = useState("");
  const [message, setMessage] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);

  const editableFields = [
    { label: "First Name", name: "first_name", type: "text" },
    { label: "Last Name", name: "last_name", type: "text" },
    { label: "Country", name: "country", type: "text" },
    { label: "Phone Number", name: "phone_number", type: "tel" }
  ];


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
    setError("");
    setLoading(true);

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
    } finally {
    setLoading(false); // Ensures the button re-enables
    }
  };
  
  if (error) return <p>{error}</p>;
  if (!user) return <p>Loading...</p>;

  
   return (
    <div>
      <h1>Profile page! </h1>
      <br></br>

      {message && <p style={{ color: "green" }}>{message}</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {!isEditing ? (
        <div>
          <p><strong>Email:</strong> {user.email}</p>
          {editableFields.map(({ label, name }) => (
            <p key={name}>
              <strong>{label}:</strong> {user[name] || "(not set)"}
            </p>
          ))}
          <button onClick={() => setIsEditing(true)}>Edit Profile</button>
        </div>
      ) : (
        <form onSubmit={handleUpdate}>
          <div>
            <label>Email:</label>
            <input name="email" value={user.email} disabled /><br />
          </div>

          {editableFields.map(({ label, name, type }) => (
            <div key={name}>
              <label>{label}:</label>
              <input
                type={type}
                name={name}
                value={user[name] || ""}
                onChange={handleChange}
              />
              <br />
            </div>
          ))}

          <button type="submit" disabled={loading}>Update Profile</button> 
          <br></br>
          <br></br>
          <button type="button" onClick={() => setIsEditing(false)}>Go back</button>
        </form>
      )}
    </div>
  );
};

export default Profile;