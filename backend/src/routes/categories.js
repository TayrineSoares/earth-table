const express = require('express');
const router = express.Router();
const supabase = require('../../supabase/db');

// GET /categories
router.get('/', async (req, res) => {
  try {
    const result = await supabase
      .from('categories')
      .select('*');

    if (result.error) {
      throw result.error;
    }

    res.json(result.data);
    
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;