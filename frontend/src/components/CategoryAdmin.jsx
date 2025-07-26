import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchUserByAuthId, fetchAllCategories, addCategory, updateCategory, deleteCategory } from '../helpers/adminHelpers'
import CategoryForm from './CategoryForm'

const CategoryAdmin = () => {
  const [categories, setCategories] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [categoryToEdit, setCategoryToEdit] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const data = await fetchAllCategories();
        setCategories(data);
      } catch (error) {
        console.error("Error fetching categories:", error);
      }
    };

    fetchCategories();
  }, []);


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
    if (!window.confirm("Are you sure you want to delete this category?")) return;
    
    try {
      await deleteCategory(id);
      setCategories(prev => prev.filter(category => category.id !==id));
    } catch (err) {
      console.error("Error deleting category:", err);
    }

  };

  const filteredCategories = categories.filter(category => {
    const term = searchTerm.toLowerCase();
    return (
      category.name?.toLowerCase().includes(term) ||
      category.description?.toLowerCase().includes(term)
   
    );
  });

  


  return (
    <div>
      <h2>Category Management</h2>

      <input
        type="text"
        placeholder="Search by category name or description"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        style={{ marginBottom: '1rem', padding: '0.5rem', width: '300px' }}
      />
    
      <br /> <br />


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

      <div >
        <h1>CATEGORIES</h1>
        
        
        {filteredCategories.map((category) => (
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

export default CategoryAdmin;
