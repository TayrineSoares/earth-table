import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchUserByAuthId, fetchAllCategories } from '../helpers/adminHelpers'


const Admin = () => {
  const [user, setUser] = useState(null);
  const [categories, setCategories] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUser = async () => {
      const storedUser = JSON.parse(localStorage.getItem('user'));

      if (!storedUser) {
        navigate('/');
        return;
      }

      try {
        const userInfo = await fetchUserByAuthId(storedUser.id);

        if (!userInfo.is_admin) {
          navigate('/');
        } else {
          setUser(userInfo);
        }
      } catch (error) {
        console.error("Error fetching user:", error);
        navigate('/');
      }
    };

    const fetchCategories = async () => {
      try {
        const data = await fetchAllCategories();
        setCategories(data);
      } catch (error) {
        console.error("Error fetching categories:", error);
      }
    };


    fetchUser();
    fetchCategories();

  }, [navigate]);


  if (!user) return null;


  return (
    <div>

      <h1>Admin Page!</h1>
      <p>Welcome, {user.first_name || user.email}</p>

      < div className='categories'>
      {categories.map((category) => (
        <div key={category.id}>
          <h3>{category.name}</h3>
          <p>{category.description}</p>
        </div>

      ))}      
    
      </div>
      
      
    </div>
  )
};

export default Admin;