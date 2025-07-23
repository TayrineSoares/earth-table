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



export {fetchUserByAuthId, fetchAllCategories, addCategory, updateCategory }; 