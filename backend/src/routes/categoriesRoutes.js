const express = require('express');
const router = express.Router();

const { getAllCategories, getHomepageCategories } = require('../queries/category');

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

module.exports = router;