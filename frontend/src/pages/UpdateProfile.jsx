import { useLocation } from 'react-router-dom';
import { useState } from 'react';

const UpdateProfile = () => {

  // We use useLocation to access data passed via navigate()
  // from the previous page (Register). This allows us to retrieve
  // the newly created user object without relying on URL params.
  // WARNING: refreshing the page loses this data.
  const location = useLocation();
  const user = location.state?.user;
  console.log(user);

  // Initialize form fields with any data that already exists
  const [formData, setFormData] = useState({
    first_name: user?.first_name || "",
    last_name: user?.last_name || "",
    country: user?.country || "",
    phone_number: user?.phone_number || "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleUpdateSubmit = async (e) => {
    e.preventDefault(); 

    try {
      const res = await fetch('http://localhost:8080/register/profile', {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: user?.id,
          ...formData
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP error. Status: ${res.status}`);
      }

      const data = await res.json(); 
      console.log('Profile updated:', data);
    } catch (err) {
      console.error("Error updating profile", err.message);
    }
  };

  
  return (
    <div>

      <h1>Profile Page!</h1>
      <form onSubmit={handleUpdateSubmit}>

        <input 
        type="text"
        name="first_name"
        placeholder="First Name"
        value={formData.first_name}
        onChange={handleChange}
        required
        />

        <br></br>

        <input 
        type="text"
        name="last_name"
        placeholder="Last Name"
        value={formData.last_name}
        onChange={handleChange}
        required
        />

        <br></br>

        <input 
        type="text"
        name="phone_number"
        placeholder="Phone Number"
        value={formData.phone_number}
        onChange={handleChange}
        required
        />

        <br></br>

        <input 
        type="text"
        name="country"
        placeholder="Country"
        value={formData.country}
        onChange={handleChange}
        required
        />

        <br></br>

        <button type="submit">
          Update profile
        </button>


      </form>
      
    </div>
  )
};

export default UpdateProfile;