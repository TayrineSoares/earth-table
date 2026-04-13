import { useEffect, useState, useRef, useMemo, Fragment } from 'react';
import {
  fetchAllProducts,
  fetchAllCategories,
  fetchAllTags,
  addProduct,
  updateProduct,
  toggleProductActive,
} from '../helpers/adminHelpers';
import ProductForm from './ProductForm';
import AdminTabLoading from './AdminTabLoading';
import '../styles/ProductAdmin.css';

const ProductAdmin = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const formRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const [productsData, categoriesData, tagsData] = await Promise.all([
          fetchAllProducts(),
          fetchAllCategories(),
          fetchAllTags(),
        ]);
        if (!cancelled) {
          setProducts(productsData);
          setCategories(categoriesData);
          setAllTags(tagsData || []);
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

  const getTagNames = (product) => {
    const ids = Array.isArray(product.tags) ? product.tags : [];
    return ids
      .map((tid) => allTags.find((t) => String(t.id) === String(tid))?.name)
      .filter(Boolean);
  };

  const categorySelectOptions = useMemo(() => {
    const ids = [...new Set(products.map((p) => p.category_id).filter((id) => id != null && id !== ''))];
    return ids
      .map((id) => ({ id: String(id), name: getCategoryName(id) || `Category ${id}` }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [products, categories]);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      if (categoryFilter !== '' && String(product.category_id) !== categoryFilter) {
        return false;
      }
      const term = searchTerm.toLowerCase().trim();
      if (!term) return true;
      const categoryName = getCategoryName(product.category_id).toLowerCase();
      const tagNamesJoined = getTagNames(product).join(' ').toLowerCase();
      return (
        product.slug?.toLowerCase().includes(term) ||
        product.description?.toLowerCase().includes(term) ||
        (product.price_cents / 100).toFixed(2).includes(term) ||
        categoryName.includes(term) ||
        tagNamesJoined.includes(term)
      );
    });
  }, [products, searchTerm, categoryFilter, categories, allTags]);

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

      <div className="product-admin-toolbar">
        <input
          type="text"
          className="product-search-input"
          placeholder="Search slug, description, price, category, or tags"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select
          className="product-category-filter"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          aria-label="Filter by category"
        >
          <option value="">All Categories</option>
          {categorySelectOptions.map(({ id, name }) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
      </div>

      <br />

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
          {filteredProducts.map((product) => {
            const tagNames = getTagNames(product);
            const isAvailable = product.is_available !== false && product.is_available !== 0;
            return (
            <div key={product.id} className="product-card">
              <img
                src={product.image_url}
                alt=""
                className="admin-product-thumb"
              />
              <div className="product-card-body">
                <div className="product-card-info">
                  <span className="product-card-slug" title={product.slug}>
                    {product.slug}
                  </span>
                  {product.description?.trim() ? (
                    <span
                      className="product-card-desc-truncate"
                      title={product.description}
                    >
                      {product.description}
                    </span>
                  ) : null}
                  <span className="product-card-line2">
                    {getCategoryName(product.category_id) || '—'} · $
                    {(product.price_cents / 100).toFixed(2)}
                  </span>
                  <div className="product-card-tags" aria-label="Tags">
                    {tagNames.length ? (
                      <span className="product-card-tags-inline">
                        {tagNames.map((name, i) => (
                          <Fragment key={`${name}-${i}`}>
                            {i > 0 ? (
                              <span className="product-card-tag-sep" aria-hidden>
                                ·
                              </span>
                            ) : null}
                            {name}
                          </Fragment>
                        ))}
                      </span>
                    ) : (
                      <span className="product-card-tags-empty">No tags</span>
                    )}
                  </div>
                  <div className="product-card-availability-row">
                    <span
                      className={
                        isAvailable
                          ? 'product-card-avail product-card-avail--yes'
                          : 'product-card-avail product-card-avail--no'
                      }
                    >
                      {isAvailable ? 'Available for purchase' : 'Not available for purchase'}
                    </span>
                  </div>
                </div>
                <div className="product-card-actions">
                  {!product.is_active && <span className="archived-badge">Archived</span>}
                  <button
                    type="button"
                    className="product-card-action-btn"
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
                  <button
                    type="button"
                    className="product-card-action-btn"
                    onClick={() => handleToggleArchive(product)}
                  >
                    {product.is_active ? 'Archive' : 'Unarchive'}
                  </button>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ProductAdmin;