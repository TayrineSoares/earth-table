import { useEffect, useState } from 'react';
import { fetchAllProducts, fetchAllCategories, addProduct, deleteProduct, updateProduct } from '../helpers/adminHelpers';
import ProductForm from './ProductForm';

const ProductAdmin = () => {
  const [products, setProducts] = useState([]); 
  const [categories, setCategories] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const data = await fetchAllProducts();
        setProducts(data);
      } catch (err) {
        console.error("Error fetching products:", err);
      }
    };

    const loadCategories = async () => {
      try {
        const data = await fetchAllCategories();
        setCategories(data);
      } catch (err) {
        console.error("Error fetching categories:", err);
      }
    };

    loadProducts(); 
    loadCategories();
  },[]);


  const handleAddProduct = async (newProductData) => {
    try {
      const createdProduct = await addProduct(newProductData);

      // Add the new product to the state
      setProducts(prev => [...prev, createdProduct]);

      // Hide the form 
      setShowForm(false);
      
    } catch (err) {
      console.error("Failed to add product:", err.message);
    }  
  };

  const handleDeleteProduct = async (productId) => {
    if (!window.confirm("Are you sure you want to delete this product?")) return;

    try {
      await deleteProduct(productId);

      // Remove deleted product from local state
      setProducts(prev => prev.filter(p => p.id !== productId));
    } catch (err) {
      console.error("Failed to delete product:", err.message);
    }
  };


  const handleUpdateProduct = async (updatedData) => {
    try {
      const updatedProduct = await updateProduct(updatedData);
      console.log("Returned from PATCH:", updatedProduct); // ← ADD THIS

      if (!updatedProduct || !updatedProduct.id) {
        throw new Error("Invalid updated product data");
      }

      setProducts(prev => 
        prev.map(p => p.id === updatedProduct.id ? updatedProduct : p)
      );
      setShowForm(false);
      setEditProduct(null);
    } catch (err) {
      console.error("Failed to update product:", err.message);
    }
  };

  const getCategoryName = (categoryId) => {
    const category = categories.find(cat => cat.id === categoryId);
    return category ? category.name : '';
  };


  const filteredProducts = products.filter(product => {
    const term = searchTerm.toLowerCase();
    const categoryName = getCategoryName(product.category_id).toLowerCase();

    return (
      product.slug?.toLowerCase().includes(term) ||
      product.description?.toLowerCase().includes(term) ||
      (product.price_cents / 100).toFixed(2).includes(term) ||
      categoryName.includes(term)
    );
  });

  
  return (
    <div>
      <h1>Product Management </h1>

      <input
        type="text"
        placeholder="Search by category, slug, description, or price"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        style={{ marginBottom: '1rem', padding: '0.5rem', width: '300px' }}
      />

      <br />

      <button 
          style={{ marginBottom: '1rem' }} 
          onClick={() => setShowForm(prev => !prev)}
        >
          {showForm ? 'Close Form' : 'Add New Product'}
        </button>
      {showForm && (
        <ProductForm 
          onSubmit={editProduct ? handleUpdateProduct : handleAddProduct}
          onCancel={() => {
            setShowForm(false);
            setEditProduct(null); 
          }}
          initialData={editProduct}
          categories={categories}
  
        />)
      }  

      {products.length === 0 ? (
        <p>No products found.</p>
      ) : (
        <div>
          {filteredProducts.map(product => (
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
                <p><strong>Category:</strong> {getCategoryName(product.category_id)}</p>

                <div className='manage buttons'> 
                  <button 
                    style={{ marginRight: '0.5rem' }} 
                    onClick={() => {
                      setEditProduct(product);     // set the selected product
                      setShowForm(true);           // show the form
                    }}
                  >
                    Edit
                  </button>
                  <button onClick={() => handleDeleteProduct(product.id)}> Delete </button>
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