const express = require('express');
const router = express.Router();
const { supabase } = require('../../supabase/db'); // make sure this exports your Supabase instance

// GET /cart/:userId → Get all cart items for user
router.get('/:userId', async (req, res) => {
  const { userId } = req.params;

  const { data, error } = await supabase
    .from('carts')
    .select('*')
    .eq('user_id', userId);

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /cart/add → Add item (or increment if it exists)
router.post('/add', async (req, res) => {
  const { userId, productId, quantity } = req.body;

  // Check if item exists
  const { data: existingItem, error: findErr } = await supabase
    .from('carts')
    .select('*')
    .eq('user_id', userId)
    .eq('product_id', productId)
    .single();

  if (findErr && findErr.code !== 'PGRST116') return res.status(500).json({ error: findErr.message });

  if (existingItem) {
    // Update quantity
    const { error: updateErr } = await supabase
      .from('carts')
      .update({ quantity: existingItem.quantity + quantity })
      .eq('id', existingItem.id);

    if (updateErr) return res.status(500).json({ error: updateErr.message });
    return res.json({ message: 'Quantity updated' });
  }

  // Insert new
  const { error: insertErr } = await supabase
    .from('carts')
    .insert([{ user_id: userId, product_id: productId, quantity }]);

  if (insertErr) return res.status(500).json({ error: insertErr.message });
  res.json({ message: 'Item added' });
});

// POST /cart/remove → Remove a specific item
router.post('/remove', async (req, res) => {
  const { userId, productId } = req.body;

  const { error } = await supabase
    .from('carts')
    .delete()
    .eq('user_id', userId)
    .eq('product_id', productId);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: 'Item removed' });
});

// POST /cart/update → Set quantity manually
router.post('/update', async (req, res) => {
  const { userId, productId, quantity } = req.body;

  const { error } = await supabase
    .from('carts')
    .update({ quantity })
    .eq('user_id', userId)
    .eq('product_id', productId);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: 'Quantity set' });
});

// POST /cart/clear → Delete all cart items for a user
router.post('/clear', async (req, res) => {
  const { userId } = req.body;

  const { error } = await supabase
    .from('carts')
    .delete()
    .eq('user_id', userId);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: 'Cart cleared' });
});

module.exports = router;
