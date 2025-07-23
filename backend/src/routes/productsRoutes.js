const express = require('express');
const router = express.Router();

const {
  getAllProducts,
  getProductById,
  getProductsByCategory, 
  createProduct,
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

// POST /products
router.post('/', async (req, res) => {
  const { slug, description, price_cents, image_url, category_id } = req.body;

  try {
    const newProduct = await createProduct({ slug, description, price_cents, image_url, category_id });
    res.status(201).json(newProduct);
  } catch (error) {
    console.error('Error creating product:', error.message);
    res.status(500).json({ error: error.message });
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