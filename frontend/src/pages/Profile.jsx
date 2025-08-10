import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchUserByAuthId, patchUserProfile } from '../helpers/userHelpers';
import "../styles/Profile.css";
import loginImage from "../assets/images/accountImage.png"


const Profile = () => {
  const { auth_user_id } = useParams();
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);

  const formatPhoneNumber = (phone) => {
    if (!phone) return "(not set)";
    const cleaned = phone.replace(/\D/g, ""); // remove non-numbers
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone; // fallback if not 10 digits
  };



  const editableFields = [
    { label: "First Name", name: "first_name", type: "text" },
    { label: "Last Name", name: "last_name", type: "text" },
    { label: "Phone Number", name: "phone_number", type: "tel" },
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
    return formErrors;
  };

  useEffect(() => {
    const loadUser = async () => {
      try {
        const data = await fetchUserByAuthId(auth_user_id);
        setUser(data);
      } catch (err) {
        setError(`Error: ${err.message}`);
      }
    };
    loadUser();
  }, [auth_user_id]);

  const handleChange = (e) => {
    setUser({ ...user, [e.target.name]: e.target.value });
  };

  const handleUpdate = async (e) => {
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
      setUser(updated);
      setIsEditing(false);
    } catch (err) {
      setError(`Server error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return <p>Loading...</p>;

  return (
    <div className='profile-form-container'>
      <div className="contact-header-image-container">
        <img
          className="contact-header-image"
          src={loginImage}
        />
      </div>
    <div className="profile-form">
      <div className='page-wrapper'>

      <h1 className="contact-text">Profile Page</h1>
      <br />

      {message && <p style={{ color: "green" }}>{message}</p>}
      {error && <p style={{ whiteSpace: "pre-line", color: "red" }}>{error}</p>}

      {!isEditing ? (
        <>
          <div className="your-name-container">
            <p className="your-name-header">Email</p>
            <p className='your-detail'>{user.email}</p>
          </div>

          {editableFields.map(({ label, name }) => (
            <div key={name} className="your-name-container">
              <p className="your-name-header">{label}</p>
              <p className="your-detail">
                {name === "phone_number"
                  ? formatPhoneNumber(user[name])
                  : (user[name] || "(not set)")}
              </p>
            </div>
          ))}

          <button
            className="contact-submit-button"
            onClick={() => {
              setIsEditing(true);
              setMessage("");
              setError("");
            }}
            >
            Edit Profile
          </button>
        </>
      ) : (
        <form onSubmit={handleUpdate}>
          <div className="your-name-container">
            <p className="your-name-header">Email</p>
            <input
              name="email"
              value={user.email}
              disabled
              className="your-name-input"
              />
          </div>

          {editableFields.map(({ label, name, type }) => (
            <div key={name} className="your-name-container">
              <p className="your-name-header">{label}</p>
              <input
                type={type}
                name={name}
                value={user[name] || ""}
                onChange={handleChange}
                className="your-name-input"
                />
            </div>
          ))}

          <br />
          <button
            className="contact-submit-button"
            type="submit"
            disabled={loading}
            >
            {loading ? "Updating..." : "Update Profile"}
          </button>
          <br /><br />
          <button
            className="contact-submit-button"
            type="button"
            onClick={() => {
              setIsEditing(false);
              setMessage("");
              setError("");
            }}
            >
            Go Back
          </button>
        </form>
      )}
    </div>
      </div>
      </div>
  );
};

export default Profile;
