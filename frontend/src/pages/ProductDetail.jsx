import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Vegan, LeafyGreen, Ham, MilkOff, BeanOff } from 'lucide-react';

function ProductDetail() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [allTags, setAllTags] = useState([]);

  const tagIcons = {
    vegan: <Vegan size={16} />,
    vegetarian: <LeafyGreen size={16} />,
    keto: <Ham size={16} />,
    'dairy free': <MilkOff size={16} />,
    paleo: <BeanOff size={16} />
  };

  useEffect(() => {
    fetch(`http://localhost:8080/products/${id}`)
      .then(res => res.json())
      .then(data => {
        setProduct(data);
        setLoading(false);
      })
      fetch('http://localhost:8080/tags')
      .then(res => res.json())
      .then(data => {
        console.log("Fetched tags:", data);  
        setAllTags(data)
      })
      .catch(err => console.error(err));
  }, [id]);

  const getTagNames = (tagIds) => {
    return tagIds
      .map(id => allTags.find(tag => tag.id === id))
      .filter(Boolean) // filter out undefined
      .map(tag => tag.name);
  };

  if (loading) return <p>Loading...</p>;
  if (!product) return <p>Product not found</p>;

  return (
    <div>
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
              <p className='product-header-name'>{product.slug}</p>
    
            </div>
            <div className='product-description-container'>
              <p className='product-header-price'>${(product.price_cents / 100).toFixed(2)}</p>
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
    </div>
  );
}

export default ProductDetail;