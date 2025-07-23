import { useEffect, useState } from 'react';
import { fetchAllProducts, fetchAllCategories } from '../helpers/adminHelpers';

const ProductAdmin = () => {
  const [products, setProducts] = useState([]); 

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const data = await fetchAllProducts();
        setProducts(data);
      } catch (err) {
        console.error("Error fetching products:", err);
      }
    };
    loadProducts(); 
  },[]);

  
  return (
    <div>
      <h1>Product Management </h1>
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