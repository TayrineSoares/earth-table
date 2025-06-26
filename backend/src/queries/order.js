const supabase = require('../../supabase/db')

async function getAllOrders() {
  const { data, error } = await supabase
    .from('orders')
    .select('*');

  if (error) throw new Error(`Error fetching orders: ${error.message}`);
  return data;
}

async function getOrderById(id) {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw new Error(`Error fetching order by id: ${error.message}`);
  return data;
};

async function getOrderByUserId(userId) {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
    
  if (error) throw new Error(`Error fetching order by userId: ${error.message}`);
  return data;
};

module.exports = {
  getAllOrders,
  getOrderById,
  getOrderByUserId
};