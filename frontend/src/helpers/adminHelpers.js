import { authFetch } from './authFetch';

const fetchUserByAuthId = async (authUserId) => {
  if (!authUserId) {
    throw new Error('authUserId is required');
  }

  const res = await authFetch(`/api/users/${authUserId}`);
  const data = await res.json();

  if (!res.ok) throw new Error(data.error || 'Failed to fetch user');

  return data;
};

const fetchAllUsers = async () => {
  const res = await authFetch('/api/users');
  const data = await res.json();

  if (!res.ok) throw new Error(data.error || 'Failed to fetch users');

  return data;
};

const updateUserAdmin = async (authUserId, isAdmin) => {
  const res = await authFetch(`/api/users/${authUserId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_admin: isAdmin }),
  });

  const data = await res.json();

  if (!res.ok) throw new Error(data.error || 'Failed to update admin status');
  return data;
};

const fetchAllCategories = async () => {
  const res = await fetch('/api/categories');
  const data = await res.json();

  if (!res.ok) throw new Error(data.error || 'Failed to fetch categories');

  return data;
};

const addCategory = async (categoryData) => {
  const res = await authFetch('/api/categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(categoryData),
  });

  const data = await res.json();

  if (!res.ok) throw new Error(data.error || 'Failed to add category');

  return data;
};

const updateCategory = async (categoryToUpdate) => {
  const res = await authFetch(`/api/categories/${categoryToUpdate.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(categoryToUpdate),
  });

  const data = await res.json();

  if (!res.ok) throw new Error(data.error || 'Failed to update category');

  return data;
};

const deleteCategory = async (id) => {
  const res = await authFetch(`/api/categories/${id}`, {
    method: 'DELETE',
  });

  const data = await res.json();

  if (!res.ok) throw new Error(data.error || 'Failed to delete category');

  return data;
};

const uploadCategoryImage = async (file) => {
  const formData = new FormData();
  formData.append('image', file);

  const res = await authFetch('/api/categories/upload', {
    method: 'POST',
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error);

  return data.url;
};

const fetchAllProducts = async () => {
  const res = await fetch('/api/products');

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Failed to fetch products');
  }

  const data = await res.json();
  return data;
};

const addProduct = async (productData) => {
  const res = await authFetch('/api/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(productData),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to add product');
  return data;
};

const updateProduct = async (updatedProduct) => {
  const res = await authFetch(`/api/products/${updatedProduct.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updatedProduct),
  });

  const data = await res.json();

  if (!res.ok) throw new Error(data.error || 'Failed to update product');

  return data;
};

const toggleProductActive = async (id, makeActive) => {
  try {
    const res = await authFetch(`/api/products/${id}/archive`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !!makeActive }),
    });

    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Archive toggle failed');
    return json.product;
  } catch (err) {
    throw new Error(err.message || 'Network error while archiving product');
  }
};

const uploadProductImage = async (file) => {
  const formData = new FormData();
  formData.append('image', file);

  const res = await authFetch('/api/products/upload', {
    method: 'POST',
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error);

  return data.url;
};

const fetchAllTags = async () => {
  const res = await fetch('/api/tags');
  const data = await res.json();

  if (!res.ok) throw new Error(data.error || 'Failed to fetch tags');

  return data;
};

const fetchProductTags = async (productId) => {
  const res = await fetch(`/api/products/${productId}/tags`);
  const data = await res.json();

  if (!res.ok) throw new Error(data.error || 'Failed to fetch product tags');

  return data.tag_ids;
};

const updateProductTags = async (productId, tagIds) => {
  const res = await authFetch(`/api/products/${productId}/tags`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tag_ids: tagIds }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update product tags');

  return data;
};

export {
  fetchUserByAuthId,
  fetchAllCategories,
  addCategory,
  updateCategory,
  deleteCategory,
  uploadCategoryImage,
  fetchAllUsers,
  updateUserAdmin,
  fetchAllProducts,
  addProduct,
  updateProduct,
  uploadProductImage,
  fetchAllTags,
  fetchProductTags,
  updateProductTags,
  toggleProductActive,
};
