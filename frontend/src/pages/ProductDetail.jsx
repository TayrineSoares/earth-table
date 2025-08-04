import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

function ProductDetail() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`http://localhost:8080/products/${id}`)
      .then(res => res.json())
      .then(data => {
        setProduct(data);
        setLoading(false);
      })
      .catch(err => console.error(err));
  }, [id]);

  if (loading) return <p>Loading...</p>;
  if (!product) return <p>Product not found</p>;

  return (
    <div>
      <h1>{product.slug}</h1>
      <img src={product.image_url} alt={product.slug} />
      <p>{product.description}</p>
      <p>${(product.price_cents / 100).toFixed(2)}</p>
      <p>Tags: {product.tags?.map(tag => tag.name).join(', ')}</p>
    </div>
  );
}

export default ProductDetail;