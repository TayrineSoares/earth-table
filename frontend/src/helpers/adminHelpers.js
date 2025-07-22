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

const fetchAllCategories = async () => {
  const res = await fetch('http://localhost:8080/categories');
  const data = await res.json(); 

  if (!res.ok) throw new Error(data.error || "Failed to fetch user");

  return data;
}


export {fetchUserByAuthId, fetchAllCategories}; 