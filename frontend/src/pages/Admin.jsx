import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Admin = () => {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem('user'));
    console.log('This is the stored user', storedUser);
  }, []);


  return (
    <div>

      <h1>Admin Page!</h1>
      
    </div>
  )
};

export default Admin;