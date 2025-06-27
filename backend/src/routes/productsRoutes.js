const express = require('express');
const router = express.Router();

const {
  getAllProducts,
  getProductById,
  getProductsByCategory
} = require('../queries/product')


// GET /products        ALL PRODUCTS
router.get('/', async (req, res) => {
  try {
    const allProducts = await getAllProducts(); // call helper function
    res.json(allProducts); //result in json format
  } catch (error) {
    console.log(error);
    res.status(500).json({error: error.message})
  }
});

// GET /products/:id    SINGLE PRODUCT BY ID
router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id; //get id from params and store it
    const product = await getProductById(id); // call helper with the id
    res.json(product); // result in json format 
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

//GET /products/category/:categoryId      PRODUCTS BY CATEGORY
router.get('/category/:categoryId', async (req, res) => {
  try {
    const categoryId = req.params.categoryId;
    const categoryProducts = await getProductsByCategory(categoryId);
    res.json(categoryProducts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
}); 

module.exports = router;