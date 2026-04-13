import { useEffect, useState, useRef } from 'react';
import { fetchAllProducts, fetchAllCategories, addProduct, updateProduct, toggleProductActive } from '../helpers/adminHelpers';
import ProductForm from './ProductForm';
import AdminTabLoading from './AdminTabLoading';
import '../styles/ProductAdmin.css';

const ProductAdmin = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const formRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const [productsData, categoriesData] = await Promise.all([
          fetchAllProducts(),
          fetchAllCategories(),
        ]);
        if (!cancelled) {
          setProducts(productsData);
          setCategories(categoriesData);
        }
      } catch (err) {
        console.error('Error fetching products or categories:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);


  const handleAddProduct = async (newProductData) => {
    try {
      const createdProduct = await addProduct(newProductData);

      setProducts(prev => [...prev, createdProduct]);
      setShowForm(false);
      
    } catch (err) {
      console.error("Failed to add product:", err.message);
    }  
  };


  const handleToggleArchive = async (product) => {
    try {
      const updated = await toggleProductActive(product.id, !product.is_active);
      setProducts(prev =>
        prev.map(prod => (prod.id === updated.id ? { ...prod, ...updated } : prod))
      );
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  };


  const handleUpdateProduct = async (updatedData) => {
    try {
      const updatedProduct = await updateProduct(updatedData);

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


  const filteredProducts = products.filter((product) => {
    const term = searchTerm.toLowerCase();
    const categoryName = getCategoryName(product.category_id).toLowerCase();

    return (
      product.slug?.toLowerCase().includes(term) ||
      product.description?.toLowerCase().includes(term) ||
      (product.price_cents / 100).toFixed(2).includes(term) ||
      categoryName.includes(term)
    );
  });

  if (loading) {
    return (
      <div className="product-admin-container">
        <h1 className="product-admin-title">Products Management </h1>
        <AdminTabLoading message="Loading products…" />
      </div>
    );
  }

  return (
    <div className="product-admin-container">
      <h1 className="product-admin-title">Products Management </h1>
      <br />

      <input
        type="text"
        className="product-search-input"
        placeholder="Search by category, slug, description, or price"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />

      <br /> <br/>

      <button
        className="toggle-form-button"
        onClick={() => setShowForm((prev) => !prev)}
      >
        {showForm ? 'Close Form' : 'Add New Product'}
      </button>
      {showForm && (
        <>
          <div ref={formRef}></div>
          <ProductForm
            onSubmit={editProduct ? handleUpdateProduct : handleAddProduct}
            onCancel={() => {
              setShowForm(false);
              setEditProduct(null);
            }}
            initialData={editProduct}
            categories={categories}
          />
        </>
      )}

      {products.length === 0 ? (
        <p>No products found.</p>
      ) : (
        <div className="product-card-container">
          {filteredProducts.map(product => (
            <div
              key={product.id}
              className="product-card"
            >
              <img src={product.image_url} alt={product.slug} className="admin-product-image" />
              <div className="product-details">
                <p><strong>Slug:</strong> {product.slug}</p>
                <p><strong>Description:</strong> {product.description}</p>
                <p><strong>Price:</strong> ${(product.price_cents / 100).toFixed(2)}</p>
                <p><strong>Category:</strong> {getCategoryName(product.category_id)}</p>

                <div className='manage-buttons'> 
                  {!product.is_active && (
                    <span className="archived-badge">
                      Archived
                    </span>
                  )}

                  <button 
                    style={{ marginRight: '0.5rem' }} 
                    onClick={() => {
                      setEditProduct(product);
                      setShowForm(true);
                      setTimeout(() => {
                        formRef.current?.scrollIntoView({ behavior: 'smooth' });
                      }, 100);
                    }}
                  >
                    Edit
                  </button>

                  <button onClick={() => handleToggleArchive(product)}>
                    {product.is_active ? 'Archive' : 'Unarchive'}
                  </button>
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