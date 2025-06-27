const express = require('express');
const router = express.Router();

const { getAllCategories } = require('../queries/categories');

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

module.exports = router;