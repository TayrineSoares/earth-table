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
  const [visibleCount, setVisibleCount] = useState(6);

  const [searchTerm, setSearchTerm] = useState("");
    
  const [isLoading, setIsLoading] = useState(true);


  const visibleProducts = allProducts.filter(p => p.is_active);
  
  const filteredProducts = categoryId
  ? visibleProducts.filter(product => product.category_id === Number(categoryId)) :  visibleProducts;

  // define norm (case/accents-insensitive compare)
  const norm = (s) =>
    (s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  // case-insensitive search on product.slug (name)
  const searchFilteredProducts = filteredProducts.filter(p =>
    norm(p.slug).includes(norm(searchTerm))
  );

  // final list shown (paginate)
  const productsToShow = searchFilteredProducts.slice(0, visibleCount);

  // reset pagination when category or search changes
  useEffect(() => {
    setVisibleCount(6);
  }, [categoryId, searchTerm]); 


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
      .filter(Boolean)
      .map(tag => tag.name);
  };


  if (isLoading) {
    return (
      <div 
        className="loading-container" 
        style={{
          minHeight: "80vh", 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center"
        }}
      >
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

      {/* Search input */}
      <div className="products-search">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search products by name…"
          aria-label="Search products by name"
          className="products-search-input"
        />
        {searchTerm && (
          <button
            className="products-search-clear"
            onClick={() => setSearchTerm("")}
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </div>

      <div className='products-container'>
      {productsToShow.map((product) => {
        return (
          <div className='products' key={product.id}>
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
            <img 
              className='product-image' 
              src={product.image_url} 
              alt={product.slug}
            />
            <div className='product-header-info-container'>
              <p className='product-header-price'>${(product.price_cents / 100).toFixed(2)}</p>    
              <p className='product-header-name'>{product.slug}</p>  
            </div>

            <div className='product-description-container'>
              <p className='product-description'>{product.description}</p>
            </div>
            
            <div className='product-add-button-container'>
              {product.is_available ? (
                <button 
                  className='product-add-button'
                  onClick={() => addToCart(product)}
                >
                  <p className='product-add-button-text'>ADD TO CART</p>
              </button>
              ) : (
                <button 
                  className='product-add-button'
                  disabled
                  style={{ cursor: 'not-allowed' }}
                >
                  <p className='product-add-button-text'>SOLD OUT!</p>
                </button>
              )}
            </div>
          </div>
          
        );
      })}
      </div>

      {visibleCount < searchFilteredProducts.length && (
        <div className='load-more-container'>
          <button 
            className="load-more-button" 
            onClick={() => {
              setVisibleCount(prev => prev + 6);
            }}
          >
            Load More
          </button>
        </div>
      )}
    </div>
  )
};

export default Products;