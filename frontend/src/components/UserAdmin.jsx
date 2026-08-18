import { useEffect, useState } from 'react';
import { fetchAllUsers, updateUserAdmin } from '../helpers/adminHelpers';
import AdminTabLoading from './AdminTabLoading';
import '../styles/UsersAdmin.css'

const UserAdmin = ({ currentUserId }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [savingId, setSavingId] = useState(null);

  useEffect (() => {
    let cancelled = false;

    const loadUsers = async () => {
      setLoading(true);
      try {
        const data = await fetchAllUsers();
        if (!cancelled) setUsers(data);
      } catch (err) {
        console.error("Error fetching users:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadUsers();
    return () => { cancelled = true; };
  }, []); 

  const formatPhoneNumber = (phone) => {
    if (!phone) return "(not set)";
    const cleaned = phone.replace(/\D/g, ""); 
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone; 
  };

  const displayName = (user) => {
    const name = [user.first_name, user.last_name].filter(Boolean).join(' ');
    return name || user.email || 'this user';
  };

  const handleAdminToggle = async (user) => {
    if (user.auth_user_id === currentUserId) return;

    const nextAdmin = !user.is_admin;
    const confirmed = window.confirm(
      nextAdmin
        ? `Grant admin access to ${displayName(user)}?`
        : `Remove admin access from ${displayName(user)}?`
    );
    if (!confirmed) return;

    setSavingId(user.auth_user_id);
    try {
      const updatedUser = await updateUserAdmin(user.auth_user_id, nextAdmin);
      setUsers((prev) =>
        prev.map((row) =>
          row.auth_user_id === updatedUser.auth_user_id ? updatedUser : row
        )
      );
    } catch (err) {
      console.error("Failed to update admin status:", err.message);
      alert(err.message || 'Failed to update admin status.');
    } finally {
      setSavingId(null);
    }
  };

  const filteredUsers = users.filter(user => {
    const term = searchTerm.toLowerCase();
    const termDigits = searchTerm.replace(/\D/g, "");
    return (
      user.email?.toLowerCase().includes(term) ||
      user.first_name?.toLowerCase().includes(term) ||
      user.last_name?.toLowerCase().includes(term) ||
      user.phone_number?.toLowerCase().includes(termDigits)
    );
  });

  if (loading) {
    return (
      <div className="user-admin-container">
        <h1 className="user-admin-title">Users Management</h1>
        <AdminTabLoading message="Loading users…" />
      </div>
    );
  }

  return (
    <div className="user-admin-container">
      <h1 className="user-admin-title">Users Management</h1>
      <br/> 

      <input
        className="user-search-input"
        type="text"
        placeholder="Search by email, name, or phone"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
      

      {users.length === 0 ? (
        <p>No users found.</p>
      ) : (
        <table className="user-table">
          <thead>
            <tr>
              <th>First Name</th>
              <th>Last Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Admin</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map(user => {
              const isSelf = user.auth_user_id === currentUserId;
              const isSaving = savingId === user.auth_user_id;
              return (
                <tr key={user.auth_user_id || user.id || user.email}>
                  <td>
                    <span className="user-name-with-badge">
                      {user.first_name}
                      {user.is_admin && <span className="admin-badge">Admin</span>}
                      {user.is_partner && <span className="partner-badge">Partner</span>}
                    </span>
                  </td>
                  <td>{user.last_name}</td>
                  <td>{user.email}</td>
                  <td>{formatPhoneNumber(user.phone_number)}</td>
                  <td>
                    <label
                      className={
                        isSelf || isSaving
                          ? 'admin-toggle is-disabled'
                          : 'admin-toggle'
                      }
                      title={
                        isSelf
                          ? "You can't change your own admin access"
                          : undefined
                      }
                    >
                      <input
                        type="checkbox"
                        checked={!!user.is_admin}
                        disabled={isSelf || isSaving}
                        onChange={() => handleAdminToggle(user)}
                      />
                      <span className="admin-toggle-track" />
                      <span className="admin-toggle-label">
                        {user.is_admin ? 'Admin' : 'Not admin'}
                      </span>
                    </label>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  )
};

export default UserAdmin;
