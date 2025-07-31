import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchUserByAuthId, patchUserProfile } from '../helpers/userHelpers';

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
    { label: "Phone Number", name: "phone_number", type: "tel" }, 
    { label: "Address Line 1", name: "address_line1", type: "text" },
    { label: "Address Line 2", name: "address_line2", type: "text" },
    { label: "City", name: "city", type: "text" },
    { label: "Province", name: "province", type: "text" },
    { label: "Postal Code", name: "postal_code", type: "text" },
    { label: "Country", name: "country", type: "text" },
    
  ];

  const validateForm = () => {
    const formErrors = []; 

    const nameRegex = /^[a-zA-ZÀ-ÿ' -]{2,}$/;

    if (!user.first_name || !nameRegex.test(user.first_name.trim())) {
      formErrors.push("First name is required and must contain only letters.");
    }

    if (!user.last_name || !nameRegex.test(user.last_name.trim())) {
      formErrors.push("Last name is required and must contain only letters.");
    }

    const phoneRegex = /^\d{10}$/;

    if (user.phone_number && !phoneRegex.test(user.phone_number.trim())) {
      formErrors.push("Phone number must be 10 digits (no dashes or spaces).");
    }

    const postalCodeRegex = /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/;

    if (user.postal_code && !postalCodeRegex.test(user.postal_code.trim())) {
      formErrors.push("Postal code must be a valid Canadian format (e.g., M4B1B3 or M4B 1B3).");
    }

     return formErrors;
  };




  useEffect (() => { 
    const loadUser = async () => {
      try {
        const data = await fetchUserByAuthId(auth_user_id);
        setUser(prev => ({
          ...data, 
          country: data.country || "Canada"
        }))
      } catch (err) {
        setError(`Error: ${err.message}`)
      }
    };

    loadUser(); 
  }, [auth_user_id]);
  


  const handleChange = (e) => {
    setUser({...user, [e.target.name]: e.target.value});
  };


  const handleUpdate = async (e) =>{
    e.preventDefault(); 
    setMessage("");
    setError("");
    setLoading(true);

    const validationErrors = validateForm();
      if (validationErrors.length > 0) {
        setError(validationErrors.join("\n"));
        setLoading(false);
        return;
      }

    try {
      const updates = {
        first_name: user.first_name,
        last_name: user.last_name,
        address_line1: user.address_line1,
        address_line2: user.address_line2,
        city: user.city,
        province: user.province,
        postal_code: user.postal_code,
        country: user.country,
        phone_number: user.phone_number
      };

      const updated = await patchUserProfile(auth_user_id, updates);
          
      setMessage("Profile updated successfully!");
      setUser(updated); //Update UI
     
    } catch (err) {
      setError(`Server error: ${err.message}`);
    } finally {
    setLoading(false); // Ensures the button re-enables
    }
  };
    
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
          <button 
            onClick={() => {
              setIsEditing(true); 
              setMessage("");
              setError("");
            }}
          >
            Edit Profile
          </button>
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
          <button type="button" onClick={() => {
            setIsEditing(false); 
            setMessage("");
            setError("");
            }}
          >
            Go back
          </button>
        </form>
      )}
    </div>
  );
};

export default Profile;