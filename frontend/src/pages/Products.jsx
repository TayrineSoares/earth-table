import Lottie from 'lottie-react';
import { useEffect, useState } from "react";
import '../styles/Products.css'
import loadingAnimation from '../assets/loading.json'
import { useParams, Link } from "react-router-dom";

const Products = ({ addToCart }) => {

  const { categoryId } = useParams();

  const [allProducts, setAllProducts] = useState([]);
  const [allCategories, setAllCategories] = useState([]);
  
  const [isLoading, setIsLoading] = useState(true);
  
  const filteredProducts = categoryId
  ? allProducts.filter(product => product.category_id === Number(categoryId)) :  allProducts;

  const selectedCategory = categoryId
  ? allCategories.find(cat => cat.id === Number(categoryId))
  : null;

  useEffect(() => {
    fetch('http://localhost:8080/products')
      .then(res => {
        if (!res.ok) {
          throw new Error(`HTTP error! :${res.status}`)
        }
        return res.json()
      })
      .then(data => {
        setAllProducts(data);
        setIsLoading(false);
      })
      .catch(err => {
        console.error(err);
        setIsLoading(false);
      });
    fetch('http://localhost:8080/categories')
      .then(res => {
        if (!res.ok) {
          throw new Error(`HTTP error! :${res.status}`)
        }
        return res.json()
      })
      .then(data => {
        setAllCategories(data);
      })
      .catch(err => {
        console.error('Error fetching categories:', err);
      });
  }, []);


  if (isLoading) {
    return (
      <div className="loading-container">
        <Lottie animationData={loadingAnimation} loop={true} />
      </div>
    );
  }

  return (
    <div className='page-wrapper'>
      
      <div className='product-title'>
        <p className='product-title-text'>Products</p>
      </div>

      <div className='categories-container'>

        <Link to="/products">
          <button className="categories">All</button>
        </Link>
       
        {allCategories.map((category) => (
          <Link
            key={category.id}
            to={`/products/${category.id}`}
          >
            <button className="categories">
              {category.name}
            </button>
          </Link>
        ))}
      </div>

      <div className='category-title-container-2'>
        <p className='category-title-2'>
          {selectedCategory ? selectedCategory.name : 'All Products'}
        </p>
      </div>

      <div className='products-container'>
      {filteredProducts.map((product) => {
        return (
          <div className='products' key={product.id}>
            <img 
              className='product-image' 
              src={product.image_url} 
              alt={product.slug}
            />
            <div className='product-header-info-container'>
              <p className='product-header-name'>{product.slug}</p>
              <p className='product-header-price'>${(product.price_cents / 100).toFixed(2)}</p>
            </div>
            <div className='product-description-container'>
              <p className='product-description'>{product.description}</p>
            </div>
            
            <div className='product-add-button-container'>
              <button 
              className='product-add-button'
              onClick={() => addToCart(product)}>
                  <p className='product-add-button-text'>ADD TO CART</p>
                </button>
            </div>
            
          </div>
        );
      })}
      </div>
    </div>
  )
};

export default Products;