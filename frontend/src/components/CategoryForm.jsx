import { forwardRef, useState, useEffect } from 'react';
import { uploadCategoryImage } from '../helpers/adminHelpers';
import FormCard from './admin/FormCard';
import FormField from './admin/FormField';
import ImageField from './admin/ImageField';

const CategoryForm = forwardRef(function CategoryForm({ onSubmit, onCancel, initialData }, ref) {
  const [formData, setFormData] = useState({
    name: '',
    image_url: '',
    description: '',
    show_on_homepage: false,
  });

  useEffect(() => {
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

  const editing = Boolean(initialData?.id);

  return (
    <FormCard
      ref={ref}
      title={editing ? 'Update Category' : 'Add New Category'}
      titleNote={editing ? `#${initialData.id}` : ''}
      onSubmit={handleSubmit}
      onCancel={onCancel}
      submitLabel={editing ? 'Save changes' : 'Create category'}
    >
      <FormField label="Name" htmlFor="category-name">
        <input
          id="category-name"
          className="admin-control"
          type="text"
          name="name"
          value={formData.name}
          placeholder="Add category name"
          onChange={handleChange}
        />
      </FormField>

      <ImageField
        id="category-image"
        value={formData.image_url}
        onChange={(imageUrl) => setFormData(prev => ({ ...prev, image_url: imageUrl }))}
        onFile={handleFileUpload}
      />

      <FormField label="Description" htmlFor="category-description">
        <textarea
          id="category-description"
          className="admin-control"
          name="description"
          value={formData.description}
          placeholder="Add category description"
          onChange={handleChange}
          rows={4}
        />
      </FormField>

      <label className="admin-check-row">
        <input
          type="checkbox"
          name="show_on_homepage"
          checked={formData.show_on_homepage}
          onChange={handleChange}
        />
        Show on homepage
      </label>
    </FormCard>
  );
});

export default CategoryForm;
