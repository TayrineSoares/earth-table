import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchUserByAuthId, fetchAllCategories, addCategory, updateCategory, deleteCategory } from '../helpers/adminHelpers'
import CategoryForm from '../components/CategoryForm'


const Admin = () => {
  const [user, setUser] = useState(null);
  const [categories, setCategories] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [categoryToEdit, setCategoryToEdit] = useState(null);

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

  const handleAddCategory = async (newCategory) => {
    try {
      const data = await addCategory(newCategory);
      setCategories(prev => [...prev, data]);
      setShowForm(false);
    } catch (err) {
      console.error("Error adding category:", err)
    }
  };

  const handleUpdateCategory = async (categoryToUpdate) => {
    try {
      const updatedCategory = await updateCategory(categoryToUpdate);
      
      //replace updated category in state
      setCategories(prev => 
        prev.map(category => (category.id === updatedCategory.id ? updatedCategory : category))
      );

      //reseet the form 
      setCategoryToEdit(null); 
      setShowForm(false); 
    } catch (err) {
      console.error("Error updating category", err);
    }

  };

  const handleDeleteCategory = async (id) => {
    try {
      await deleteCategory(id);
      setCategories(prev => prev.filter(category => category.id !==id));
    } catch (err) {
      console.error("Error deleting category:", err);
    }

  };

  

  return (
    <div>

      <h1>Admin Page!</h1>
      <p>Welcome, {user.first_name || user.email}</p>
      <br />
      <button 
          style={{ marginBottom: '1rem' }} 
          onClick={() => setShowForm(prev => !prev)}
        >
          {showForm ? 'Close Form' : 'Add New Category'}
        </button>
      {showForm && (
        <CategoryForm 
          onSubmit={(formData) => {
            if (categoryToEdit) {
              handleUpdateCategory(formData); 
            } else {
              handleAddCategory(formData);
            }
          }} 
          onCancel={() => {
            setShowForm(false)
            setCategoryToEdit(null);
          }}
          initialData={categoryToEdit}
        />)}

      <div className='categories'>
        <h1>CATEGORIES</h1>
        
        
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

              
              <div className='manage buttons'> 
                <button 
                  style={{ marginRight: '0.5rem' }}
                  onClick={() => {
                    setCategoryToEdit(category); // set the selected category
                    setShowForm(true);            // show the form
                  }}
                                  
                >
                    Edit
                </button>
                <button 
                  onClick={() => handleDeleteCategory(category.id)}
                >
                  Delete
                </button>

              </div>
              
            </div>
          </div>
        ))}
      </div>
      
      
    </div>
  )
};

export default Admin;