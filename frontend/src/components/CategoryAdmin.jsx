import { useEffect, useState, useRef } from 'react';
import { 
  fetchAllCategories, 
  addCategory, 
  updateCategory, 
  deleteCategory 
} from '../helpers/adminHelpers'
import CategoryForm from './CategoryForm'
import AdminTabLoading from './AdminTabLoading';
import AdminToolbar from './admin/AdminToolbar';
import AdminListItem from './admin/AdminListItem';
import AdminButton from './admin/AdminButton';
import Badge from './admin/Badge';
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

      <AdminToolbar
        searchValue={searchTerm}
        searchPlaceholder="Search by name or description"
        searchLabel="Search by name or description"
        onSearchChange={(e) => setSearchTerm(e.target.value)}
        actionLabel={showForm ? 'Close Form' : 'Add New Category'}
        onAction={() => {
          if (showForm) {
            setShowForm(false);
            setCategoryToEdit(null);
            return;
          }
          setShowForm(true);
        }}
        resultLabel={`${filteredCategories.length} ${filteredCategories.length === 1 ? 'category' : 'categories'}`}
      />

      {showForm && (
        <CategoryForm
          ref={formRef}
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
      )}

      <div className="admin-list">
        {filteredCategories.map((category) => (
          <AdminListItem
            key={category.id}
            image={category.image_url}
            title={category.name}
            capitalize
            description={category.description?.trim() ? category.description : ''}
            meta={category.show_on_homepage ? <Badge tone="accent">On homepage</Badge> : null}
            actions={(
              <>
                <AdminButton
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setCategoryToEdit(category);
                    setShowForm(true);
                    setTimeout(() => {
                      formRef.current?.scrollIntoView({ behavior: 'smooth' });
                    }, 0);
                  }}
                >
                  Edit
                </AdminButton>
                <AdminButton
                  variant="danger"
                  size="sm"
                  onClick={() => handleDeleteCategory(category.id)}
                >
                  Delete
                </AdminButton>
              </>
            )}
          />
        ))}
      </div>
    </div>
  );
};

export default CategoryAdmin;
