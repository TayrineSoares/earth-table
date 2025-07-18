import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

const Profile = () => {

  const { auth_user_id } = useParams(); //get the ID from the URL
  const [ user, setUser ] = useState(null); 
  const [ error, setError ] = useState("");

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

  if (error) return <p>{error}</p>;
  if (!user) return <p>Loading...</p>;

  return (
    <div>
      <h1>Profile</h1>
      <p><strong>First Name:</strong> {user.first_name || "Please update your profile"}</p>
      <p><strong>Last Name:</strong> {user.last_name || "Please update your profile"}</p>
      <p><strong>Email:</strong> {user.email}</p>
      <p><strong>Country:</strong> {user.country || "Please update your profile"}</p>
      <p><strong>Phone Number:</strong> {user.phone_number || "Please update your profile"}</p>

      
    </div>
  )
};

export default Profile;
