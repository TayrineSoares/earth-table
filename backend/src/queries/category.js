const supabase = require('../../supabase/db')

async function getAllCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('*');

  if (error) throw new Error(`Error fetching categories: ${error.message}`);
  return data;
};

async function getHomepageCategories() {
  const {data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('show_on_homepage', true);
  
  if (error) throw new Error(`Error fetching homepage categories: ${error.message}`);
  return data;
}

async function createCategory({ name, image_url, description, show_on_homepage }) {
  const { data, error } = await supabase
    .from('categories')
    .insert([
      {
        name,
        image_url,
        description,
        show_on_homepage,
      }
    ])
    .select(); //  returns the inserted row

  if (error) throw new Error(`Error creating category: ${error.message}`);
  return data[0]; // return the newly created category
}


async function updateCategory (id, infoToUpdate ) {
  const { data, error } = await supabase
    .from('categories')
    .update(infoToUpdate)
    .eq('id', id)
    .select();

    if (error) throw new Error(`Error updating category: ${error.message}`);
    return data[0];
}



module.exports = {
  getAllCategories,
  getHomepageCategories, 
  createCategory,
  updateCategory,
};

