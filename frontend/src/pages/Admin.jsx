import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Admin = () => {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUser = async () => {
      const storedUser = JSON.parse(localStorage.getItem('user'));

      if (!storedUser ) {
        navigate('/');
        return;
      }

      try {
        const res = await fetch(`http://localhost:8080/users/${storedUser.id}`);
        const data = await res.json();

        if (!res.ok || !data.is_admin) {
          navigate('/');

        } else {
          setUser(data);
        }
      } catch (err) {
        console.error("Error fetching user from backend:", err);
        navigate('/');
      }
    };
    
    fetchUser();
  
  }, [navigate]);

  if (!user) return null;


  return (
    <div>

      <h1>Admin Page!</h1>
      <p>Welcome, {user.first_name || user.email}</p>
      
      
    </div>
  )
};

export default Admin;