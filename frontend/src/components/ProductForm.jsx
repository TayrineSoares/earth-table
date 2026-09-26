import { forwardRef, useState, useEffect } from 'react';
import { uploadProductImage, fetchAllTags, fetchProductTags } from '../helpers/adminHelpers';
import FormCard from './admin/FormCard';
import FormField from './admin/FormField';
import ImageField from './admin/ImageField';

const ProductForm = forwardRef(function ProductForm({ onSubmit, onCancel, initialData, categories }, ref) {
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

  const editing = Boolean(initialData?.id);

  return (
    <FormCard
      ref={ref}
      title={editing ? 'Update Product' : 'Add New Product'}
      titleNote={editing ? `#${initialData.id}` : ''}
      onSubmit={handleSubmit}
      onCancel={onCancel}
      submitLabel={editing ? 'Save changes' : 'Create product'}
    >
      <FormField
        label="Name"
        hint="Used as the product slug"
        htmlFor="product-slug"
      >
        <input
          id="product-slug"
          className="admin-control"
          name="slug"
          type="text"
          value={formData.slug}
          onChange={handleChange}
          aria-describedby="product-slug-hint"
          required
        />
      </FormField>

      <ImageField
        id="product-image"
        value={formData.image_url}
        onChange={(imageUrl) => setFormData(prev => ({ ...prev, image_url: imageUrl }))}
        onFile={handleFileUpload}
        required
      />

      <FormField label="Description" htmlFor="product-description">
        <textarea
          id="product-description"
          className="admin-control"
          name="description"
          value={formData.description}
          placeholder="Add product description"
          onChange={handleChange}
          rows={4}
        />
      </FormField>

      <FormField label="Price" htmlFor="product-price">
        <div className="admin-prefix-field">
          <span className="admin-prefix" aria-hidden="true">$</span>
          <input
            id="product-price"
            className="admin-control admin-prefix-input"
            name="price_cents"
            type="number"
            inputMode="decimal"
            value={formData.price_cents}
            onChange={handleChange}
            step="0.01"
            min="0"
          />
        </div>
      </FormField>

      <FormField label="Category" htmlFor="product-category">
        <select
          id="product-category"
          className="admin-control"
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
      </FormField>

      <FormField label="Tags">
        <div className="admin-check-chips">
          {allTags.map(tag => (
            <label key={tag.id} className="admin-check-chip">
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
      </FormField>

      <label className="admin-check-row">
        <input
          type="checkbox"
          name="is_available"
          checked={formData.is_available}
          onChange={handleChange}
        />
        Available
      </label>
    </FormCard>
  );
});

export default ProductForm;
