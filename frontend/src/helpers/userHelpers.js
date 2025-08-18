//Fetches whole user info object
const fetchUserByAuthId = async (authUserId) => {

  if (!authUserId) {
    throw new Error("authUserId is required");
  }

  const res = await fetch(`/api/users/${authUserId}`);
  const data = await res.json();

  if (!res.ok) throw new Error(data.error || "Failed to fetch user");

  return data;
};

// Fetch all users
const fetchAllUsers = async () => {
  const res = await fetch('/api/users');
  const data = await res.json();

  if (!res.ok) throw new Error(data.error || "Failed to fetch users");

  return data;
};

// update user info
const patchUserProfile = async(authUserId, updates) => {
  if (!authUserId) throw new Error ("authUserId is required"); 

  const res = await fetch (`/api/users/${authUserId}`, {
        method: "PATCH", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Failed to update user");
  }
  return data;
}


export { 
  fetchUserByAuthId, 
  fetchAllUsers,
  patchUserProfile,
}; 