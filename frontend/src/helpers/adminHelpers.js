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
const updateProduct = async () => {
  
};

//Delete a product
const deleteProduct = async (productId) => {
  const res = await fetch(`http://localhost:8080/products/${productId}`, {
    method: 'DELETE',
  });

  const data = await res.json();

  if (!res.ok) throw new Error(data.error || "Failed to delete product");

  return data;
};


export { 
  fetchUserByAuthId, 
  fetchAllCategories, 
  addCategory, 
  updateCategory, 
  deleteCategory, 
  fetchAllUsers, 
  updateUserAdmin,
  fetchAllProducts,
  addProduct,
  updateProduct,
  deleteProduct,
}; 