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
      <h1>Produc Management </h1>
      {products.length === 0 ? (
        <p>No products found.</p>
      ) : (
        <ul>
          {products.map(product => (
            <li key={product.id}>
              {product.slug} - ${(product.price_cents / 100).toFixed(2)}
            </li>

          ))}
        </ul>
      
      )}
      
    </div>
  )
};

export default ProductAdmin;
