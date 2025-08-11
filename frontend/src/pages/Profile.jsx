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
  const [draft, setDraft] = useState(null);

  const formatPhoneNumber = (phone) => {
    if (!phone) return "(not set)";
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  // Shows (123) 456-7890 while typing, but never returns symbols to state
  const formatPhoneForInput = (value) => {
    const cleaned = (value || "").replace(/\D/g, "").slice(0, 10);
    if (cleaned.length < 4) return cleaned;
    if (cleaned.length < 7) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  };

  // Special onChange just for the phone field
  const handlePhoneTyping = (e) => {
    const digitsOnly = e.target.value.replace(/\D/g, "").slice(0, 10);
    setDraft((prev) => ({ ...prev, phone_number: digitsOnly }));
  };


  const editableFields = [
    { label: "First Name", name: "first_name", type: "text" },
    { label: "Last Name", name: "last_name", type: "text" },
    { label: "Phone Number", name: "phone_number", type: "tel" },
  ];

  const validateForm = (data) => {
    const formErrors = [];
    const nameRegex = /^[a-zA-ZÀ-ÿ' -]{2,}$/;

    if (!data.first_name || !nameRegex.test(data.first_name.trim())) {
      formErrors.push("First name is required and must contain only letters.");
    }
    if (!data.last_name || !nameRegex.test(data.last_name.trim())) {
      formErrors.push("Last name is required and must contain only letters.");
    }

    const phoneRegex = /^\d{10}$/;
    if (data.phone_number && !phoneRegex.test(data.phone_number.trim())) {
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
    setDraft({ ...draft, [e.target.name]: e.target.value });
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");
    setLoading(true);

    const validationErrors = validateForm(draft);
    if (validationErrors.length > 0) {
      setError(validationErrors.join("\n"));
      setLoading(false);
      return;
    }

    try {
      const updates = {
        first_name: draft.first_name,
        last_name: draft.last_name,
        address_line1: draft.address_line1,
        address_line2: draft.address_line2,
        city: draft.city,
        province: draft.province,
        postal_code: draft.postal_code,
        country: draft.country,
        phone_number: draft.phone_number
      };
      const updated = await patchUserProfile(auth_user_id, updates);
      setMessage("Profile updated successfully!");
      setUser(updated);
      setIsEditing(false);
      setDraft(null);
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
              setDraft({...user});  
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
              {name === "phone_number" ? (
                <input
                  type="tel"
                  name="phone_number"
                  inputMode="numeric"
                  autoComplete="tel"
                  value={formatPhoneForInput(draft?.phone_number)}
                  onChange={handlePhoneTyping}
                  className="your-name-input"
                  placeholder="(XXX) XXX-XXXX"
                />
              ) : (
              <input
                type={type}
                name={name}
                value={draft?.[name] || ""}
                onChange={handleChange}
                className="your-name-input"
                />
              )}
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
              setDraft(null);
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
