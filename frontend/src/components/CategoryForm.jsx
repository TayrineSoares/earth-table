import { useState } from 'react';

const CategoryForm = ({ onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    name: '',
    image_url: '',
    description: '',
    show_on_homepage: false,
  });



  return (

    <div>
      <h1>I AM THE CATEGORY FORM </h1>
      <div className='category form'>
        <h2>Add New Category</h2>

        <div>
          <label>Name:</label>
          <input type="text" value={formData.name} placeholder='Add Category Name'/><br /><br />
        </div>

        <div>
          <label>Image:</label>
          <input type="text" value={formData.image_url} placeholder='Add Category Image URL'/><br /><br />
        </div>

        <div>
          <label>Description</label>
          <input type="text" value={formData.description} placeholder='Add Category Description'/><br /><br />
        </div>

        <div>
          <label>
            <input type="checkbox" checked={formData.show_on_homepage} />
            Show on homepage
          </label><br /><br />
        </div>

      </div>
        <button>Submit</button>
        <button style={{ marginLeft: '1rem' }}>Cancel</button>
      
      
    </div>
  )
};

export default CategoryForm;
