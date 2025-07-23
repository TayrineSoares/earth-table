import { useEffect, useState } from 'react';
import { fetchAllUsers } from '../helpers/adminHelpers';

const UserAdmin = () => {
  const [users, setUsers] = useState([]); 

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


  return (
    <div>
      <h1>User Management</h1>
      {users.length === 0 ? (
      <p>No users found.</p>
      ) : (
        <table border="1" cellPadding="8">
          <thead>
            <tr>
              <th>Email</th>
              <th>First Name</th>
              <th>Last Name</th>
              <th>Country</th>
              <th>Phone</th>
              <th>Admin?</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.auth_user_id || user.id || user.email}>
                <td>{user.email}</td>
                <td>{user.first_name}</td>
                <td>{user.last_name}</td>
                <td>{user.country}</td>
                <td>{user.phone_number}</td>
                <td>{user.is_admin ? 'Yes' : 'No'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      
    </div>
  )
};

export default UserAdmin;
