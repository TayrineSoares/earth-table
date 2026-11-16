const express = require('express');
const router = express.Router();

const {
  getAllOrders,
  getOrderById,
  getOrderByUserId,
  getOrderByStripeSessionId,
  setOrderPickedUp,
} = require('../queries/order');

const { getProductsForOrder } = require('../queries/order_product');
const {
  requireAuth,
  requireAdmin,
  requireSelfOrAdmin,
  loadCallerUserRow,
  isAdminUser,
} = require('../middleware/requireAuth');

async function assertOrderReadable(req, order) {
  await loadCallerUserRow(req);
  if (isAdminUser(req)) return true;
  if (order?.user_id && order.user_id === req.user.id) return true;
  return false;
}

// GET ALL ORDERS — admin
router.get('/', requireAdmin, async (req, res) => {
  try {
    const allOrders = await getAllOrders();
    res.json(allOrders);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// GET ORDER BY STRIPE SESSION ID (public capability URL)
router.get('/session/:sessionId', async (req, res) => {
  const { sessionId } = req.params;

  try {
    const order = await getOrderByStripeSessionId(sessionId);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET ORDERS BY USER ID — self or admin
router.get('/user/:id', requireAuth, requireSelfOrAdmin('id'), async (req, res) => {
  const authUserId = req.params.id;

  try {
    const userOrders = await getOrderByUserId(authUserId);
    res.json(userOrders);
  } catch (error) {
    console.error('Failed to fetch orders by authUserId:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET PRODUCTS FOR AN ORDER — owner or admin
router.get('/:id/products', requireAuth, async (req, res) => {
  try {
    const orderId = req.params.id;
    const order = await getOrderById(orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (!(await assertOrderReadable(req, order))) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const products = await getProductsForOrder(orderId);
    res.json(products);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// GET ORDER BY ID — owner or admin
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const orderId = req.params.id;
    const order = await getOrderById(orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (!(await assertOrderReadable(req, order))) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    res.json(order);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Mark picked up — admin
router.patch('/:id/picked-up', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { picked_up } = req.body;
  try {
    const updated = await setOrderPickedUp(id, picked_up);
    res.json(updated);
  } catch (err) {
    console.error('Failed to set picked_up:', err.message);
    res.status(500).json({ error: 'Failed to update order picked_up' });
  }
});

module.exports = router;
