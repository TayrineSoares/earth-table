import Lottie from 'lottie-react';
import { useEffect, useState } from "react";
import '../styles/Products.css'
import loadingAnimation from '../assets/loading.json'
import { useParams, Link } from "react-router-dom";
import { Vegan, LeafyGreen, Ham, MilkOff, BeanOff } from 'lucide-react';


const Products = ({ addToCart }) => {

  const { categoryId } = useParams();

  const [allProducts, setAllProducts] = useState([]);
  const [allCategories, setAllCategories] = useState([]);
  const [allTags, setAllTags] = useState([]);
  
  
  const [isLoading, setIsLoading] = useState(true);
  
  const filteredProducts = categoryId
  ? allProducts.filter(product => product.category_id === Number(categoryId)) :  allProducts;

  const selectedCategory = categoryId
  ? allCategories.find(cat => cat.id === Number(categoryId))
  : null;

  const tagIcons = {
    vegan: <Vegan size={16} />,
    vegetarian: <LeafyGreen size={16} />,
    keto: <Ham size={16} />,
    'dairy free': <MilkOff size={16} />,
    paleo: <BeanOff size={16} />
  };

  useEffect(() => {
    fetch('http://localhost:8080/products')
      .then(res => {
        if (!res.ok) {
          throw new Error(`HTTP error! :${res.status}`)
        }
        return res.json()
      })
      .then(data => {
        console.log("Fetched products:", data);
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
      });
    fetch('http://localhost:8080/tags')
      .then(res => res.json())
      .then(data => {
        console.log("Fetched tags:", data);  
        setAllTags(data)
      })
        
      .catch(err => console.error("Error fetching tags:", err));
  }, []);

  const getTagNames = (tagIds) => {
    return tagIds
      .map(id => allTags.find(tag => tag.id === id))
      .filter(Boolean) // filter out undefined
      .map(tag => tag.name);
  };


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

        <Link to="/products/category/">
          <button className="categories">All</button>
        </Link>
       
        {allCategories.map((category) => (
          <Link
            key={category.id}
            to={`/products/category/${category.id}`}
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

            {product.tags && product.tags.length > 0 && (
              <div className="product-tags">
                {getTagNames(product.tags).map((tagName) => (
                  <div key={tagName} className="tag-icon">
                    {tagIcons[tagName.toLowerCase()] || null}
                    <span style={{ marginLeft: '4px' }}>{tagName}</span>
                  </div>
                ))}
              </div>
            )}  
            
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