const express = require('express');
const router = express.Router();
const { supabase } = require('../../supabase/db');
const { requireAuth } = require('../middleware/requireAuth');

function resolveCartUserId(req, res) {
  const fromBody = req.body?.userId;
  const fromParams = req.params?.userId;
  const claimed = fromBody != null && String(fromBody).trim() !== ''
    ? fromBody
    : (fromParams != null && String(fromParams).trim() !== '' ? fromParams : null);
  if (claimed != null && String(claimed) !== String(req.user.id)) {
    res.status(400).json({ error: 'userId does not match the signed-in user.' });
    return null;
  }
  return req.user.id;
}

// Default-deny: all cart API ops require auth (guest cart is localStorage only).
router.use(requireAuth);

// GET /cart → signed-in user's cart
router.get('/', async (req, res) => {
  const userId = req.user.id;
  const { data, error } = await supabase
    .from('carts')
    .select('*')
    .eq('user_id', userId);

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Legacy path: GET /cart/:userId (must match caller)
router.get('/:userId', async (req, res) => {
  const userId = resolveCartUserId(req, res);
  if (!userId) return;

  const { data, error } = await supabase
    .from('carts')
    .select('*')
    .eq('user_id', userId);

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/add', async (req, res) => {
  const userId = resolveCartUserId(req, res);
  if (!userId) return;
  const { productId, quantity } = req.body;

  const { data: existingItem, error: findErr } = await supabase
    .from('carts')
    .select('*')
    .eq('user_id', userId)
    .eq('product_id', productId)
    .single();

  if (findErr && findErr.code !== 'PGRST116') return res.status(500).json({ error: findErr.message });

  if (existingItem) {
    const { error: updateErr } = await supabase
      .from('carts')
      .update({ quantity: existingItem.quantity + quantity })
      .eq('id', existingItem.id);

    if (updateErr) return res.status(500).json({ error: updateErr.message });
    return res.json({ message: 'Quantity updated' });
  }

  const { error: insertErr } = await supabase
    .from('carts')
    .insert([{ user_id: userId, product_id: productId, quantity }]);

  if (insertErr) return res.status(500).json({ error: insertErr.message });
  res.json({ message: 'Item added' });
});

router.post('/remove', async (req, res) => {
  const userId = resolveCartUserId(req, res);
  if (!userId) return;
  const { productId } = req.body;

  const { error } = await supabase
    .from('carts')
    .delete()
    .eq('user_id', userId)
    .eq('product_id', productId);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: 'Item removed' });
});

router.post('/update', async (req, res) => {
  const userId = resolveCartUserId(req, res);
  if (!userId) return;
  const { productId, quantity } = req.body;

  const { error } = await supabase
    .from('carts')
    .update({ quantity })
    .eq('user_id', userId)
    .eq('product_id', productId);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: 'Quantity set' });
});

router.post('/clear', async (req, res) => {
  const userId = resolveCartUserId(req, res);
  if (!userId) return;

  const { error } = await supabase
    .from('carts')
    .delete()
    .eq('user_id', userId);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: 'Cart cleared' });
});

module.exports = router;
