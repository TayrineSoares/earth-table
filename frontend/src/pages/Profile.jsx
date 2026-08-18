import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Check, Info, Star } from 'lucide-react';
import { fetchUserByAuthId, patchUserProfile } from '../helpers/userHelpers';
import {
  fetchPartnerDetailByUser,
  formatCents,
  formatPayoutLabel,
  setPayoutPreference,
} from '../helpers/partnerHelpers';
import PartnerMonthList from '../components/PartnerMonthList';
import "../styles/Profile.css";
import loginImage from "../assets/images/accountImage.png"
import loadingAnimation from '../assets/loading.json'
import Lottie from 'lottie-react';

const ProfileInfoTip = ({ text }) => (
  <span className="profile-info-tip">
    <button
      type="button"
      className="profile-info-button"
      aria-label={text}
    >
      <Info size={14} strokeWidth={2} />
    </button>
    <span className="profile-info-tooltip" role="tooltip">
      {text}
    </span>
  </span>
);

const Profile = () => {
  const { auth_user_id } = useParams();
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [partner, setPartner] = useState(null);
  const [savingPayout, setSavingPayout] = useState(false);

  const formatPhoneNumber = (phone) => {
    if (!phone) return "(not set)";
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  const formatPhoneForInput = (value) => {
    const cleaned = (value || "").replace(/\D/g, "").slice(0, 10);
    if (cleaned.length < 4) return cleaned;
    if (cleaned.length < 7) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  };

  const handlePhoneTyping = (e) => {
    const digitsOnly = e.target.value.replace(/\D/g, "").slice(0, 10);
    setDraft((prev) => ({ ...prev, phone_number: digitsOnly }));
  };

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
        const [data, partnerData] = await Promise.all([
          fetchUserByAuthId(auth_user_id),
          fetchPartnerDetailByUser(auth_user_id).catch(() => null),
        ]);
        setUser(data);
        setPartner(partnerData);
      } catch (err) {
        setError(`Error: ${err.message}`);
      } finally {
        setIsLoading(false);
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

  const handlePayoutSwitch = async (payoutType) => {
    if (!partner || partner.payout_type === payoutType || savingPayout) return;
    setSavingPayout(true);
    setError("");
    try {
      const updated = await setPayoutPreference(auth_user_id, payoutType);
      setPartner((prev) => ({
        ...prev,
        ...updated,
        months: prev.months,
      }));
    } catch (err) {
      setError(err.message || 'Failed to update payout preference.');
    } finally {
      setSavingPayout(false);
    }
  };

  if (isLoading) {
    return (
      <div 
        className="loading-container" 
        style={{
          minHeight: "80vh", 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center"
        }}
      >
        <Lottie animationData={loadingAnimation} loop={true} />
      </div>
    );
  }

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
          <h1 className="profile-text">
            <span>{user.first_name}'s Profile</span>
            {partner && (
              <span className="profile-partner-badge">
                <Star size={12} fill="currentColor" strokeWidth={0} />
                Partner
              </span>
            )}
          </h1>

          {message && <p className="profile-status is-success">{message}</p>}
          {error && <p className="profile-status is-error">{error}</p>}

          {!isEditing ? (
            <>
              <div className="profile-grid">
                <div className="profile-field">
                  <p className="profile-field-label">First Name</p>
                  <p className="profile-field-value">{user.first_name || '(not set)'}</p>
                </div>
                <div className="profile-field">
                  <p className="profile-field-label">Last Name</p>
                  <p className="profile-field-value">{user.last_name || '(not set)'}</p>
                </div>
                <div className="profile-field">
                  <p className="profile-field-label">Phone Number</p>
                  <p className="profile-field-value">{formatPhoneNumber(user.phone_number)}</p>
                </div>
                <div className="profile-field">
                  <p className="profile-field-label">Email</p>
                  <p className="profile-field-value">{user.email}</p>
                </div>
              </div>

              <button
                className="profile-submit-button"
                type="button"
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
              <div className="profile-grid">
                <div className="profile-field">
                  <p className="profile-field-label">First Name</p>
                  <input
                    type="text"
                    name="first_name"
                    value={draft?.first_name || ""}
                    onChange={handleChange}
                    className="profile-field-input"
                  />
                </div>
                <div className="profile-field">
                  <p className="profile-field-label">Last Name</p>
                  <input
                    type="text"
                    name="last_name"
                    value={draft?.last_name || ""}
                    onChange={handleChange}
                    className="profile-field-input"
                  />
                </div>
                <div className="profile-field">
                  <p className="profile-field-label">Phone Number</p>
                  <input
                    type="tel"
                    name="phone_number"
                    inputMode="numeric"
                    autoComplete="tel"
                    value={formatPhoneForInput(draft?.phone_number)}
                    onChange={handlePhoneTyping}
                    className="profile-field-input"
                    placeholder="(XXX) XXX-XXXX"
                  />
                </div>
                <div className="profile-field">
                  <p className="profile-field-label">Email</p>
                  <input
                    name="email"
                    value={user.email}
                    disabled
                    className="profile-field-input"
                  />
                </div>
              </div>

              <div className="profile-actions">
                <button
                  className="profile-submit-button"
                  type="submit"
                  disabled={loading}
                >
                  {loading ? "Updating..." : "Update Profile"}
                </button>
                <button
                  className="profile-submit-button"
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
              </div>
            </form>
          )}

          {partner && (
            <section className="profile-partner">
              <h2 className="profile-partner-title">Partner earnings</h2>

              <div className="profile-partner-grid">
                <div className="profile-field">
                  <p className="profile-field-label">Referral code</p>
                  <p className="profile-field-value">{partner.referral_code}</p>
                </div>
                <div className="profile-field profile-payout-field">
                  <p className="profile-field-label">
                    Payout
                    <ProfileInfoTip text="Applies to new orders immediately. Cash is invoiced at the end of the month; credit is available immediately." />
                  </p>
                  <div className="profile-payout-switch">
                    {['cash', 'credit'].map((type) => (
                      <button
                        key={type}
                        type="button"
                        className={
                          partner.payout_type === type
                            ? 'profile-payout-button is-active'
                            : 'profile-payout-button'
                        }
                        disabled={savingPayout || partner.payout_type === type}
                        onClick={() => handlePayoutSwitch(type)}
                      >
                        {partner.payout_type === type && (
                          <Check size={14} strokeWidth={2.5} />
                        )}
                        {formatPayoutLabel(type)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="profile-field">
                  <p className="profile-field-label">This month</p>
                  <p className="profile-field-value">{formatCents(partner.current_month_cents)}</p>
                </div>
                <div className="profile-field">
                  <p className="profile-field-label">
                    Total earnings
                    <ProfileInfoTip text="All cashback you've earned from referrals, including cash and store credit." />
                  </p>
                  <p className="profile-field-value">{formatCents(partner.total_earn_cents)}</p>
                </div>
                <div className="profile-field">
                  <p className="profile-field-label">
                    Wallet balance
                    <ProfileInfoTip text="Store credit applied automatically on your next order." />
                  </p>
                  <p className="profile-field-value">{formatCents(partner.available_credit_cents)}</p>
                </div>
              </div>

              <PartnerMonthList months={partner.months || []} />
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
