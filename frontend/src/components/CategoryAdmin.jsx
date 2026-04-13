import { useEffect, useState, useRef } from 'react';
import { 
  fetchAllCategories, 
  addCategory, 
  updateCategory, 
  deleteCategory 
} from '../helpers/adminHelpers'
import CategoryForm from './CategoryForm'
import AdminTabLoading from './AdminTabLoading';
import '../styles/CategoryAdmin.css'

const CategoryAdmin = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [categoryToEdit, setCategoryToEdit] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const formRef = useRef();

  useEffect(() => {
    let cancelled = false;

    const fetchCategories = async () => {
      setLoading(true);
      try {
        const data = await fetchAllCategories();
        if (!cancelled) setCategories(data);
      } catch (error) {
        console.error("Error fetching categories:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchCategories();
    return () => { cancelled = true; };
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
      
      setCategories(prev => 
        prev.map(category => (category.id === updatedCategory.id ? updatedCategory : category))
      );

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

  if (loading) {
    return (
      <div className="category-admin-container">
        <h1 className="category-admin-title">Categories Management</h1>
        <AdminTabLoading message="Loading categories…" />
      </div>
    );
  }

  return (
    <div className="category-admin-container">
      <h1 className="category-admin-title">Categories Management</h1>
      <br />

      <div className="category-admin-toolbar">
        <input
          type="text"
          className="category-search-input"
          placeholder="Search by name or description"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <button
        type="button"
        className="toggle-form-button"
        onClick={() => setShowForm((prev) => !prev)}
      >
        {showForm ? 'Close Form' : 'Add New Category'}
      </button>

      {showForm && (
        <div ref={formRef}>
          <CategoryForm
            onSubmit={(formData) => {
              if (categoryToEdit) {
                handleUpdateCategory(formData);
              } else {
                handleAddCategory(formData);
              }
            }}
            onCancel={() => {
              setShowForm(false);
              setCategoryToEdit(null);
            }}
            initialData={categoryToEdit}
          />
        </div>
      )}

      <div className="category-card-container">
        {filteredCategories.map((category) => (
          <div className="category-card" key={category.id}>
            <img
              className="category-thumb"
              src={category.image_url}
              alt=""
            />
            <div className="category-card-body">
              <div className="category-card-info">
                <span className="category-card-name" title={category.name}>
                  {category.name}
                </span>
                <span
                  className="category-card-desc-preview"
                  title={category.description || ''}
                >
                  {category.description?.trim() ? category.description : '—'}
                </span>
                <span className="category-card-homepage">
                  Homepage: {category.show_on_homepage ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="category-card-actions">
                <button
                  type="button"
                  className="category-card-action-btn"
                  onClick={() => {
                    setCategoryToEdit(category);
                    setShowForm(true);
                    setTimeout(() => {
                      formRef.current?.scrollIntoView({ behavior: 'smooth' });
                    }, 0);
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="category-card-action-btn"
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
  );
};

export default CategoryAdmin;
