const express = require('express');
const router = express.Router();

const { getAllCategories, getHomepageCategories, createCategory, updateCategory, deleteCategory } = require('../queries/category');

// GET /categories
router.get('/', async (req, res) => {
  try {
    const categories = await getAllCategories();
    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /categories/homepage
router.get('/homepage', async (req, res) => {
  try {
    const homepageCategories = await getHomepageCategories(); 
    res.json(homepageCategories);
  } catch (error) {
    console.error('Error fetching homepage categories:', error.message);
    res.status(500).json({ error: error.message });

  }
});

// POST /categories 
router.post('/', async (req, res) => {
  const { name, image_url, description, show_on_homepage } = req.body;

  try {
    const newCategory = await createCategory({
      name,
      image_url,
      description,
      show_on_homepage
    });

    res.status(201).json(newCategory);
  } catch (error) {
    console.error('Error creating category:', error.message);
    res.status(500).json({ error: error.message });
  }
});

//PATCH /categories/:id
router.patch('/:id', async (req, res) => {
  const categoryId = req.params.id;
  const updatedFields = req.body; 

  //console.log("Updating category:", categoryId, updatedFields);

  try {
    const updatedCategory = await updateCategory(categoryId, updatedFields);
    res.json(updatedCategory);

  } catch (error) {
    console.error("Error updating category:", error);
    res.status(500).json({ error: error.message });
  }
});


//DELETE /categories/:id
router.delete('/:id', async (req, res) => {
  const categoryId = req.params.id;

  try {
    await deleteCategory(categoryId);
    res.json({ message: `Category ${categoryId} deleted` });
  } catch (error) {
    console.error("Error deleting category:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;