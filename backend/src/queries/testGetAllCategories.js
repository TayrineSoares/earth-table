const { getAllCategories } = require('./category');

async function test() {
  try {
    const categories = await getAllCategories();
    console.log('Categories:', categories);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

test();