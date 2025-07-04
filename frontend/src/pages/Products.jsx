import Lottie from 'lottie-react';
import { useEffect, useState } from "react";
import '../styles/Products.css'
import loadingAnimation from '../assets/loading.json'

const Products = () => {
  const [allProducts, setAllProducts] = useState([]);
  const [allCategories, setAllCategories] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null)
  const [isLoading, setIsLoading] = useState(true);

  const filteredCategory = selectedCategoryId 
  ? allProducts.filter(product => product.category_id === selectedCategoryId) :  allProducts;

  useEffect(() => {
    fetch('http://localhost:8080/products')
      .then(res => res.json())
      .then(data => {
        setAllProducts(data);
        setIsLoading(false);
      })
      .catch(err => {
        console.error(err);
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    fetch('http://localhost:8080/products')
      .then((res) => res.json()) // Parse the JSON response
      .then((data) => setAllProducts(data))
      .catch((err) => console.error(err));
  }, []); // Empty array = runs only once on mount

  useEffect(() => {
    fetch('http://localhost:8080/categories')
      .then(res => res.json())
      .then(data => setAllCategories(data))
      .catch(console.error);
  }, []);

  if (isLoading) {
    return (
      <div className="loading-container">
        <Lottie animationData={loadingAnimation} loop={true} />
      </div>
    );
  }

  return (
    <div>

      <div className='categories-container'>
        <button onClick={() => setSelectedCategoryId(null)}>All</button>
        {allCategories.map((category) => (
          <button 
          className='categories' 
          key={category.id}
          onClick={() => setSelectedCategoryId(category.id)}
          >
            {category.name}
          </button>
        ))}
      </div>

      <div className='products-container'>
      {filteredCategory.map((product) => (
        <div className='products' key={product.id}>
          <h3>{product.slug}</h3>
          <img 
            src={product.image_url} 
            alt={product.slug} 
            style={{ width: '300px', height: '200px', objectFit: 'cover' }}  
            />
          <p>{product.description}</p>
          <h3>${(product.price_cents / 100).toFixed(2)}</h3>
          <hr/>

        </div>
      ))}
      </div>   
    </div>
  )
};

export default Products;