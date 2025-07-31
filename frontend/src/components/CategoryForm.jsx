import { useState, useEffect } from 'react';
import { uploadCategoryImage } from '../helpers/adminHelpers';
import '../styles/CategoryForm.css'

const CategoryForm = ({ onSubmit, onCancel, initialData }) => {
  const [formData, setFormData] = useState({
    name: '',
    image_url: '',
    description: '',
    show_on_homepage: false,
  });

  useEffect(() => {
    // If initialData is provided (editing), pre-fill the form
    if (initialData && Object.keys(initialData).length > 0) {
      setFormData({
        name: initialData.name || '',
        image_url: initialData.image_url || '',
        description: initialData.description || '',
        show_on_homepage: initialData.show_on_homepage || false,
      });
    }
  }, [initialData]);


  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };


  const handleSubmit = (e) => {
    e.preventDefault(); 

    const submission = { ...formData, id: initialData?.id };
    onSubmit(submission);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const url = await uploadCategoryImage(file);
      setFormData(prev => ({
        ...prev,
        image_url: url,
      }));
    } catch (err) {
      console.error("Error uploading image:", err.message);
    }
  };

  
  return (

    <div>
  
      <form onSubmit={handleSubmit} className='category-form'>
        <h2 className="category-form-title">
          {initialData?.id ? 'Update Category' : 'Add New Category'}
        </h2>
        <div>
          {initialData?.id && (
            <div>
              <label>ID:</label>
              <input 
                type="text"
                value={initialData.id}
                disabled
              />
              <br /><br />
            </div>
          )}

          <label>Name:</label>
          <input 
            type="text"
            name="name"
            value={formData.name} 
            placeholder='Add Category Name'
            onChange={handleChange}
          /><br /><br />
        </div>

        <div>
          <label>Add Image URL:</label>
          <input 
            type="text"
            name="image_url"
            value={formData.image_url} 
            placeholder='Add Category Image URL'
            onChange={handleChange}
          />
          <br /><br />
        </div>
        <h3>OR</h3>
        <div>
          <label>Upload Image:</label>
          <input 
            type="file" 
            accept="image/*"
            onChange={handleFileUpload}
          /><br /><br />
        </div>

        <div>
          <label>Description</label>
          <textarea
            name="description"
            value={formData.description}
            placeholder="Add Category Description"
            onChange={handleChange}
            rows={4} 

          />
        </div>

        <div>
          <label>
            <input 
              type="checkbox"
              name="show_on_homepage"
              checked={formData.show_on_homepage} 
              onChange={handleChange}
            />
            Show on homepage
          </label><br /><br />
        </div>

        <button type="submit">Submit</button>
        <button type="button" style={{ marginLeft: '1rem' }} onClick={onCancel}>Cancel</button>

      </form>
      
      
    </div>
  );
};

export default CategoryForm;
