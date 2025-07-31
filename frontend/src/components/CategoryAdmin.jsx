import { useEffect, useState } from 'react';
import { 
  fetchAllCategories, 
  addCategory, 
  updateCategory, 
  deleteCategory 
} from '../helpers/adminHelpers'
import CategoryForm from './CategoryForm'
import '../styles/CategoryAdmin.css'

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
    <div className="category-admin-container">
      <h1 className="category-admin-title">Categories Management</h1>
      <br />

      <input
        type="text"
        className="category-search-input"
        placeholder="Search by Category Name or Description"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
    
      <br /> <br />


      <button 
          className="toggle-form-button"
          onClick={() => setShowForm(prev => !prev)}
        >
          {showForm ? 'Close Form' : 'Add New Category'}
      </button>
      <br /> <br />
      

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
      <br /> <br /> 
        
        
        {filteredCategories.map((category) => (
          <div
            className="category-card"
            key={category.id}
            
          >
            <img 
              className="category-image"
              src={category.image_url} 
              alt={category.name} 
               />

            <div className="category-details">
              <h2>{category.name}</h2>
              <p><strong>Image Url:</strong> {category.image_url}</p>
              <p><strong>Description:</strong> {category.description}</p>
              <p><strong>Show on Homepage:</strong> {category.show_on_homepage ? 'Yes' : 'No'}</p>

              
              <div className='manage-buttons'> 
                <button 
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
