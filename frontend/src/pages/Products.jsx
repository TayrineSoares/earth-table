import Lottie from 'lottie-react';
import { ShoppingCart } from "lucide-react";
import { useEffect, useState } from "react";
import '../styles/Products.css'
import loadingAnimation from '../assets/loading.json'
import { useParams, Link } from "react-router-dom";

const Products = ({ addToCart, cart }) => {

  const { categoryId } = useParams();

  const [allProducts, setAllProducts] = useState([]);
  const [allCategories, setAllCategories] = useState([]);
  
  const [isLoading, setIsLoading] = useState(true);
  
  const filteredProducts = categoryId
  ? allProducts.filter(product => product.category_id === Number(categoryId)) :  allProducts;

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
    <div>

      <div className='categories-container'>

        <Link to="/products">
          <button>All</button>
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

      <div className='products-container'>
      {filteredProducts.map((product) => {
        return (
          <div className='products' key={product.id}>
            <h3>{product.slug}</h3>
            <img 
              className='product-image' 
              src={product.image_url} 
              alt={product.slug}
            />
            <p>{product.description}</p>
            <h3>${(product.price_cents / 100).toFixed(2)}</h3>
            <button onClick={() => addToCart(product)}>
              <ShoppingCart/>
            </button>
            <hr/>
          </div>
        );
      })}
      </div>
    </div>
  )
};

export default Products;