const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer(); 

const {
  getAllProducts,
  getProductById,
  getProductsByCategory, 
  createProduct,
  deleteProductById,
  updateProductById,
  uploadProductImage,
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

// DELETE /products/:id
router.delete('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    await deleteProductById(id);
    res.json({ message: `Product ${id} deleted successfully` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// PATCH /products/:id — Update product
router.patch('/:id', async (req, res) => {
  const id = req.params.id;
  const updatedData = req.body;

  try {
    const updatedProduct = await updateProductById(id, updatedData);
    res.json(updatedProduct);
  } catch (error) {
    console.error(error);
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

// UPLOAD PRODUCT IMAGE
router.post('/upload', upload.single('image'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    const url = await uploadProductImage(file.buffer, file.originalname, file.mimetype);
    res.json({ url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


module.exports = router;