const express = require('express');
const router = express.Router();
const supabase = require('../../supabase/db');
const { getAllTags } = require('../queries/tags')


router.get('/', async (req, res) => {
  try {
    const tags = await getAllTags();
    res.json(tags); 
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: error.message });
  }
});



module.exports = router;