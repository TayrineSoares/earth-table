

import { useEffect, useState } from "react";

const Products = () => {
  const [allProducts, setAllProducts] = useState([]);

  useEffect(() => {
    fetch('http://localhost:8080/products')
      .then((res) => res.json()) // Parse the JSON response
      .then((data) => setAllProducts(data))
      .catch((err) => console.error(err));
  }, []); // Empty array = runs only once on mount

  return (
    <div>

      <h1>Products Page!</h1>
      {allProducts.map((product) => (
        <div key={product.id}>
          <h3>{product.slug}</h3>
          <p>{product.description}</p>
          <h3>${(product.price_cents / 100).toFixed(2)}</h3>
          <hr/>

        </div>
      ))}
      
    </div>
  )
};

export default Products;