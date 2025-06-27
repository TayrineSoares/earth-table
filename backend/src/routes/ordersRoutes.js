const express = require('express');
const router = express.Router();

const {
  getAllOrders,
  getOrderById,
  getOrderByUserId
} = require('../queries/order')

const { getProductsForOrder } = require('../queries/order_product')

// MORE SPECIFIC ROUTES GO FIRST

// GET PRODUCTS FOR AN ORDER
router.get('/:id/products', async (req, res) => {
  try {
    const orderId = req.params.id;
    const products = await getProductsForOrder(orderId);
    res.json(products);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
});

// GET ORDERS BY USER ID 
router.get('/user/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    const userOrders = await getOrderByUserId(userId);
    res.json(userOrders);

  } catch (error) {
    console.log(error);
    res.status(500).json({error: error.message});
  }
});

// GET ORDER BY ID 
router.get('/:id', async (req, res) => {
  try {
    const orderId = req.params.id;
    const order = await getOrderById(orderId); 
    res.json(order);

  } catch (error) {
    console.log(error);
    res.status(500).json({error: error.message});
  }
}); 


// GET ALL ORDERS 
router.get('/', async (req, res) => {
  try {
    const allOrders = await getAllOrders(); 
    res.json(allOrders);
  } catch (error) {
    console.log(error);
    res.status(500).json({error: error.message});
  }
}); 



module.exports = router