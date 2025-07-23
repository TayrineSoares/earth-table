import { useEffect, useState } from 'react';
import { fetchAllProducts, fetchAllCategories, addProduct, deleteProduct, updateProduct } from '../helpers/adminHelpers';
import ProductForm from './ProductForm';

const ProductAdmin = () => {
  const [products, setProducts] = useState([]); 
  const [categories, setCategories] = useState([]);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const data = await fetchAllProducts();
        setProducts(data);
      } catch (err) {
        console.error("Error fetching products:", err);
      }
    };

    const loadCategories = async () => {
      try {
        const data = await fetchAllCategories();
        setCategories(data);
      } catch (err) {
        console.error("Error fetching categories:", err);
      }
    };

    loadProducts(); 
    loadCategories();
  },[]);


  const handleAddProduct = async (newProductData) => {
    try {
      const createdProduct = await addProduct(newProductData);

      // Add the new product to the state
      setProducts(prev => [...prev, createdProduct]);

      // Hide the form 
      setShowForm(false);
      
    } catch (err) {
      console.error("Failed to add product:", err.message);
    }  
  };

  
  return (
    <div>
      <h1>Product Management </h1>
      <button 
          style={{ marginBottom: '1rem' }} 
          onClick={() => setShowForm(prev => !prev)}
        >
          {showForm ? 'Close Form' : 'Add New Product'}
        </button>
      {showForm && (
        <ProductForm 
          onSubmit={handleAddProduct}
          onCancel={() => setShowForm(false)}
          initialData={null}
          categories={categories}
        
        />)}

      {products.length === 0 ? (
        <p>No products found.</p>
      ) : (
        <div>
          {products.map(product => (
            <div
              key={product.id}
              style={{
                display: 'flex',
                gap: '1rem',
                border: '2px solid #ccc',
                padding: '1rem',
                marginBottom: '1rem',
                alignItems: 'center',
              }}
            >
              <img src={product.image_url} alt={product.slug} width="100" />
              <div>
                <p><strong>Slug:</strong> {product.slug}</p>
                <p><strong>Description:</strong> {product.description}</p>
                <p><strong>Price:</strong> ${(product.price_cents / 100).toFixed(2)}</p>
                <p><strong>Category ID:</strong> {product.category_id}</p>

                <div className='manage buttons'> 
                  <button 
                    style={{ marginRight: '0.5rem' }} 
                    onClick={() => (console.log("edit button clicked"))}> 
                    Edit 
                  </button>
                  <button onClick={() => (console.log("delete button clicked"))}> Delete </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProductAdmin;