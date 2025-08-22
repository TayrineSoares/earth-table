import { useEffect, useState } from 'react';
import { fetchAllUsers, updateUserAdmin } from '../helpers/adminHelpers';
import '../styles/UsersAdmin.css'

const UserAdmin = () => {
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect (() => {
    const loadUsers = async () => {
      try {
        const data = await fetchAllUsers();
        setUsers(data);
      } catch (err) {
        console.error("Error fetching users:", err);
      }
    };
    loadUsers();
  }, []); 

  const formatPhoneNumber = (phone) => {
    if (!phone) return "(not set)";
    const cleaned = phone.replace(/\D/g, ""); 
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone; 
  };


  const handleAdminToggle = async (user) => {
    try {
      const updatedUser = await updateUserAdmin(user.auth_user_id, !user.is_admin);

      setUsers(prev =>
        prev.map(user => user.auth_user_id === updatedUser.auth_user_id ? updatedUser : user)
      );
    } catch (err) {
      console.error("Failed to update admin status:", err.message);
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
              <th>Email</th>
              <th>First Name</th>
              <th>Last Name</th>
              <th>Address</th>
              <th>City</th>
              <th>Province</th>
              <th>Country</th>
              <th>Phone</th>
              <th>Admin?</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map(user => (
              <tr key={user.auth_user_id || user.id || user.email}>
                <td>{user.email}</td>
                <td>{user.first_name}</td>
                <td>{user.last_name}</td>
                <td>{user.address_line1} {user.address_line2}</td>
                <td>{user.city}</td>
                <td>{user.province}</td>
                <td>{user.country}</td>
                <td>{formatPhoneNumber(user.phone_number)}</td>
                <td>{user.is_admin ? 'Yes' : 'No'}</td>
                <td>
                  <input
                    type="checkbox"
                    checked={user.is_admin}
                    onChange={() => handleAdminToggle(user)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
};

export default UserAdmin;
