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

    const submission = { ...formData, id: initialData?.id };
    onSubmit(submission);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]; //get first file selected by user
    if (!file) return; // if no file exit 

    //create new formData object
    const formData = new FormData();
    formData.append('image', file); //add the file with the key "image"

    try {
      //send file to backend API route to upload on supabase storage
      // the backend will return an URL
      const res = await fetch('http://localhost:8080/categories/upload', {
      method: 'POST',
      body: formData,
    });

    // parse the response 
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    //update the form state with image's public URL returned from backend
    setFormData(prev => ({
      ...prev,
      image_url: data.url
    }));
  } catch (err) {
    console.error("Error uploading image:", err.message);
  }
};

  
  return (

    <div>
  
      <form onSubmit={handleSubmit} className='category-form'>
        <h2>Add or Update a Category</h2>
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
