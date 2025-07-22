import { useState, useEffect } from 'react';

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
    onSubmit(formData);
  }


  return (

    <div>
      <h1>I AM THE CATEGORY FORM </h1>
  
      <form onSubmit={handleSubmit} className='category-form'>
        <h2>Add New Category</h2>
        <div>
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
          <label>Image:</label>
          <input 
            type="text"
            name="image_url"
            value={formData.image_url} 
            placeholder='Add Category Image URL'
            onChange={handleChange}
          /><br /><br />
        </div>

        <div>
          <label>Description</label>
          <input 
            type="text" 
            name="description"
            value={formData.description} 
            placeholder='Add Category Description'
            onChange={handleChange}
          /><br /><br />
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
