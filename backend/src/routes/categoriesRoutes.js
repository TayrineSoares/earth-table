const express = require('express');
const router = express.Router();

const { getAllCategories, getHomepageCategories, createCategory } = require('../queries/category');

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

//PATCH /categories 

module.exports = router;