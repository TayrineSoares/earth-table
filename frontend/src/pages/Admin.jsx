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
  //console.log(categories);


  return (
    <div>

      <h1>Admin Page!</h1>
      <p>Welcome, {user.first_name || user.email}</p>


      <div className='categories'>
        <h1>CATEGORIES</h1>
        <button 
          style={{ marginBottom: '1rem' }} 
          onClick={() => console.log('Add category clicked')} 
        >
          Add New Category
        </button>
        
        {categories.map((category) => (
          <div
            key={category.id}
            style={{
              display: 'flex',
              gap: '1rem',
              border: '3px solid #ccc',
              padding: '1rem',
              marginBottom: '1rem',
              alignItems: 'center',
              maxWidth: '70vw',
            }}
          >
            <img src={category.image_url} alt={category.name} width="150" />
            <div>
              <h2>{category.name}</h2>
              <p><strong>Image Url:</strong> {category.image_url}</p>
              <p><strong>Description:</strong> {category.description}</p>
              <p><strong>Show on Homepage:</strong> {category.show_on_homepage ? 'Yes' : 'No'}</p>
              <p><strong>Created at:</strong> {category.created_at}</p>
              <p><strong>Updated at:</strong> {category.update_at}</p>
              
              <div className='manage buttons'> 
                <button style={{ marginRight: '0.5rem' }}>Edit</button>
                <button>Delete</button>

              </div>
              
            </div>
          </div>
        ))}
      </div>
      
      
    </div>
  )
};

export default Admin;