// USERS FUNCTIONS

//Fetches whole user info object
const fetchUserByAuthId = async (authUserId) => {

  if (!authUserId) {
    throw new Error("authUserId is required");
  }

  const res = await fetch(`http://localhost:8080/users/${authUserId}`);
  const data = await res.json();

  if (!res.ok) throw new Error(data.error || "Failed to fetch user");

  return data;
};

// Fetch all users
const fetchAllUsers = async () => {
  const res = await fetch('http://localhost:8080/users');
  const data = await res.json();

  if (!res.ok) throw new Error(data.error || "Failed to fetch users");

  return data;
};

// Update user's admin permission 
const updateUserAdmin = async (authUserId, isAdmin) => {
  const res = await fetch(`http://localhost:8080/users/${authUserId}`, {
    method: 'PATCH', 
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_admin: isAdmin }),

  });

  const data = await res.json(); 

  if (!res.ok) throw new Error(data.error || "Failed to update admin status");
  return data;

}


// -------------------------------------
// CATEGORIES FUNCTIONS 

//Fetch ALL categories
const fetchAllCategories = async () => {
  const res = await fetch('http://localhost:8080/categories');
  const data = await res.json(); 

  if (!res.ok) throw new Error(data.error || "Failed to fetch user");

  return data;
}


// Add New Category 
const addCategory = async (categoryData) => {
  const res = await fetch('http://localhost:8080/categories', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(categoryData),
  });

  const data = await res.json();

  if (!res.ok) throw new Error(data.error || "Failed to add category");

  return data;
};


// Update an existing category 
const updateCategory = async (categoryToUpdate) => {
  const res = await fetch(`http://localhost:8080/categories/${categoryToUpdate.id}` , {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    }, 
    body: JSON.stringify(categoryToUpdate),
  });

  const data = await res.json();

  if (!res.ok) throw new Error(data.error || "Failed to update category");

  return data;

};

//Delete an existing category 
const deleteCategory = async (id) => {
  const res = await fetch(`http://localhost:8080/categories/${id}` , {
    method: 'DELETE',
  });

  const data = await res.json();

  if (!res.ok) throw new Error(data.error || "Failed to delete category");

  return data;

}

// Upload a category image 
const uploadCategoryImage = async (file) => {
  const formData = new FormData();
  formData.append('image', file);

  const res = await fetch('http://localhost:8080/categories/upload', {
    method: 'POST',
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error);

  return data.url;
};



//------------------------------------------------------
// PRODUCTS FUNCTIONS

//Fetch ALL products 
const fetchAllProducts = async () => {
  const res = await fetch('http://localhost:8080/products');

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Failed to fetch products');
  }

  const data = await res.json();
  return data;

};

//Add a new product
const addProduct = async (productData) => {
  const res = await fetch('http://localhost:8080/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(productData),

  });

  const data = await res.json(); 
  if (!res.ok) throw new Error(data.error || "Failed to add product");
  return data;

};

//Update an existing product
const updateProduct = async (updatedProduct) => {
  const res = await fetch(`http://localhost:8080/products/${updatedProduct.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updatedProduct),
  });

  const data = await res.json();

  if (!res.ok) throw new Error(data.error || 'Failed to update product');

  return data;
};

// Archive a product 
const toggleProductActive = async (id, makeActive) => {
  try {
    const res = await fetch(`http://localhost:8080/products/${id}/archive`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !!makeActive })
    });

    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Archive toggle failed');
    return json.product; // { id, slug, is_active }
  } catch (err) {
    throw new Error(err.message || 'Network error while archiving product');
  }

}

//Upload a produc image 
const uploadProductImage = async (file) => {
  const formData = new FormData();
  formData.append('image', file);

  const res = await fetch('http://localhost:8080/products/upload', {
    method: 'POST',
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error);

  return data.url;
};

//------------------------------------------------------------------------------
// TAGS FUNCTIONS

// fetch all tags 
const fetchAllTags = async () => {
  const res = await fetch('http://localhost:8080/tags');
  const data = await res.json();

  if (!res.ok) throw new Error(data.error || "Failed to fetch tags");

  return data;
};

// fetch tags for a specific product by id 
const fetchProductTags = async (productId) => {
  const res = await fetch(`http://localhost:8080/products/${productId}/tags`);
  const data = await res.json();

  if (!res.ok) throw new Error(data.error || "Failed to fetch product tags");

  return data.tag_ids; 
};

// update tags of a selected product
const updateProductTags = async (productId, tagIds) => {
  const res = await fetch(`http://localhost:8080/products/${productId}/tags`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ tag_ids: tagIds }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to update product tags");

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