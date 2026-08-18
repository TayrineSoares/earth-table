const supabase = require('../../supabase/db')

function decorateUserWithPartner(user, partner) {
  if (!user) return user;
  return {
    ...user,
    is_partner: !!partner,
    referral_code: partner ? String(partner.referral_code || '').toUpperCase() : null,
  };
}

async function attachPartnerFields(users) {
  const isArray = Array.isArray(users);
  const list = isArray ? users : users ? [users] : [];
  if (!list.length) return isArray ? [] : null;

  const ids = [...new Set(list.map((u) => u.auth_user_id).filter(Boolean))];
  let byUserId = {};

  if (ids.length) {
    const { data, error } = await supabase
      .from('partners')
      .select('user_id, referral_code, active')
      .in('user_id', ids);

    if (error) throw new Error(`Error fetching partners for users: ${error.message}`);
    byUserId = Object.fromEntries((data || []).map((p) => [p.user_id, p]));
  }

  const decorated = list.map((u) => decorateUserWithPartner(u, byUserId[u.auth_user_id]));
  return isArray ? decorated : decorated[0];
}

async function getAllUsers() {
  const { data, error } = await supabase
    .from('users')
    .select('*');
    
  if (error) throw new Error(`Error fetching users: ${error.message}`);
  return attachPartnerFields(data || []);
};

async function getUserByAuthId(authUserId) {
  if (!authUserId) {
    throw new Error("authUserId is required");
  }

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('auth_user_id', authUserId)
    .maybeSingle();

  if (error) throw new Error(`Error fetching user by Auth Id: ${error.message}`);
  if (!data) return data;
  return attachPartnerFields(data);
}

async function updateUserByAuthId(authUserId, updates) {
  if (!authUserId) {
    throw new Error("authUserId is required");
  }

  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('auth_user_id', authUserId)
    .select()
    .single();

  if (error) {
    throw new Error(`Error updating user: ${error.message}`);
  }

  return attachPartnerFields(data);
}

module.exports = {
  getAllUsers,
  getUserByAuthId,
  updateUserByAuthId,
};