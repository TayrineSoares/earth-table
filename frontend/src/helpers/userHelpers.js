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

const fetchCurrentUser = async () => {
  const res = await authFetch('/api/users/me');
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

const patchUserProfile = async (authUserId, updates) => {
  if (!authUserId) throw new Error('authUserId is required');

  const res = await authFetch(`/api/users/${authUserId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || 'Failed to update user');
  }
  return data;
};

export {
  fetchUserByAuthId,
  fetchCurrentUser,
  fetchAllUsers,
  patchUserProfile,
};
