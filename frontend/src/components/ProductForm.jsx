import { useState, useEffect } from 'react';
import { uploadProductImage, fetchAllTags, fetchProductTags } from '../helpers/adminHelpers';

const ProductForm = ({ onSubmit, onCancel, initialData, categories }) => {
  const [formData, setFormData] = useState({
    id: '',
    slug: '',
    image_url: '',
    description: '',
    is_available: true,
    price_cents: 0,
    category_id: '',
  });

  const [allTags, setAllTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);

  const resetForm = () => {
    setFormData({
      id: '',
      slug: '',
      image_url: '',
      description: '',
      is_available: true,
      price_cents: 0,
      category_id: '',
    });
    setSelectedTags([]);
  };

  useEffect(() => {
    const initializeForm = async () => {
      try {
        const tags = await fetchAllTags(); 
        setAllTags(tags);

        if (initialData && Object.keys(initialData).length > 0) {
          setFormData({
            id: initialData.id || '',
            slug: initialData.slug || '',
            image_url: initialData.image_url || '',
            description: initialData.description || '',
            is_available: initialData.is_available ?? true,
            price_cents: initialData.price_cents / 100 || 0,
            category_id: initialData.category_id || '',
          });

          const productTagIds = await fetchProductTags(initialData.id);
          setSelectedTags(productTagIds);
        } else {
          resetForm();
        }
      } catch (err) {
        console.error("Error initializing form:", err.message);
      }
    }; 
    initializeForm();
    
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

    const processedForm = {
      ...formData,
      price_cents: Math.round(parseFloat(formData.price_cents) * 100),
      tag_ids: selectedTags,
    };

    onSubmit(processedForm);

    // Reset form state
    setFormData({
      id: '',
      slug: '',
      image_url: '',
      description: '',
      is_available: true,
      price_cents: 0,
      category_id: '',
    });
    setSelectedTags([]); 
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const url = await uploadProductImage(file);
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
        <h3>OR</h3>

        <div>
          <label>Upload Image:</label>
          <input 
            type="file" 
            accept="image/*"
            onChange={handleFileUpload}
          /><br /><br />
        </div>


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

        <label>Tags:</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
            {allTags.map(tag => (
              <label key={tag.id}>
                <input
                  type="checkbox"
                  value={tag.id}
                  checked={selectedTags.includes(tag.id)}
                  onChange={(e) => {
                    const tagId = parseInt(e.target.value);
                    if (e.target.checked) {
                      setSelectedTags(prev => [...prev, tagId]);
                    } else {
                      setSelectedTags(prev => prev.filter(id => id !== tagId));
                    }
                  }}
                />
                {tag.name}
              </label>
            ))}
          </div>

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
