import { useState, useEffect } from 'react';

const ProductForm = ({ onSubmit, onCancel, initialData, categories }) => {
  const [formData, setFormData] = useState({
    slug: '',
    image_url: '',
    description: '',
    is_available: true,
    price_cents: 0,
    category_id: '',
  });

  useEffect(() => {
    // If initialData is provided (editing), pre-fill the form
    if (initialData && Object.keys(initialData).length > 0) {
      setFormData({
        slug: initialData.slug || '',
        image_url: initialData.image_url || '',
        description: initialData.description || '',
        is_available: initialData.is_available || true,
        price_cents: initialData.price_cents || 0,
        category_id: initialData.category_id || '',
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

    // Convert price from string dollars to cents
    const processedForm = {
      ...formData,
      price_cents: Math.round(parseFloat(formData.price_cents) * 100),
    };

    onSubmit(processedForm);
    //reset the form
    setFormData({
      slug: '',
      image_url: '',
      description: '',
      is_available: true,
      price_cents: 0,
      category_id: '',
    });
  };


  return (
    <div>
      <h2>Add or update a Product</h2>
      <form onSubmit={handleSubmit} className='product-form'>
        <label>
          Slug:
          <input name="slug" value={formData.slug} onChange={handleChange} required />
        </label>
        <br /> <br />

        <label>
          Image URL:
          <input name="image_url" value={formData.image_url} onChange={handleChange} required />
        </label>
        <br /> <br />

        <label>
          Description:
          <textarea name="description" value={formData.description} onChange={handleChange} />
        </label>
        <br /> <br />

        <label>
          Price ($):
          <input
            name="price_cents"
            type="number"
            value={formData.price_cents}
            onChange={handleChange}
            step="0.01"
            min="0"
          />
        </label>
        <br /> <br />

        <label>
          Category:
          <select
            name="category_id"
            value={formData.category_id}
            onChange={handleChange}
            required
          >
            <option value="">Select a category</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </label>
        <br /> <br />

        <label>
          Available:
          <input
            type="checkbox"
            name="is_available"
            checked={formData.is_available}
            onChange={handleChange}
          />
        </label>
        <br /> <br />

        <button type="submit">Submit</button>
        <button type="button" onClick={onCancel} style={{ marginLeft: '1rem' }}>
          Cancel
        </button>
      </form>
      <br /> 
      <br /> 
      
    </div>
  )
};

export default ProductForm;
