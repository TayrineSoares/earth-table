import { useEffect, useState, useRef, useMemo } from 'react';
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
import AdminToolbar from './admin/AdminToolbar';
import AdminListItem from './admin/AdminListItem';
import AdminButton from './admin/AdminButton';
import Badge from './admin/Badge';
import '../styles/ProductAdmin.css';
import '../styles/AdminShared.css';

const ProductAdmin = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  /** 'all' | 'active' (listed) | 'archived' (hidden from storefront) */
  const [archiveTab, setArchiveTab] = useState('all');
  /** 'all' | 'available' | 'sold_out' */
  const [availabilityFilter, setAvailabilityFilter] = useState('all');
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
    if (product.is_active) {
      const confirmed = window.confirm('Are you sure you want to archive this product?');
      if (!confirmed) return;
    }
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

  const tabFilteredProducts = useMemo(() => {
    return filteredProducts.filter((product) => {
      if (archiveTab === 'active' && !product.is_active) return false;
      if (archiveTab === 'archived' && product.is_active) return false;

      const isAvailable = product.is_available !== false && product.is_available !== 0;
      if (availabilityFilter === 'available' && !isAvailable) return false;
      if (availabilityFilter === 'sold_out' && isAvailable) return false;
      return true;
    });
  }, [filteredProducts, archiveTab, availabilityFilter]);

  if (loading) {
    return (
      <div className="product-admin-container">
        <h1 className="product-admin-title">Menu Management </h1>
        <AdminTabLoading message="Loading products…" />
      </div>
    );
  }

  return (
    <div className="product-admin-container">
      <h1 className="product-admin-title">Menu Management </h1>
      <p className="admin-tab-lead">
        All the dishes customers can order — bowls, salads, mains, and add-ons.
        Update names, prices, and photos here. Archiving hides a dish from the menu without deleting it.
      </p>

      <AdminToolbar
        searchValue={searchTerm}
        searchPlaceholder="Search slug, description, price, category, or tags"
        searchLabel="Search slug, description, price, category, or tags"
        onSearchChange={(e) => setSearchTerm(e.target.value)}
        actionLabel={showForm ? 'Close Form' : 'Add New Product'}
        onAction={() => {
          if (showForm) {
            setShowForm(false);
            setEditProduct(null);
            return;
          }
          setShowForm(true);
        }}
        resultLabel={products.length === 0
          ? ''
          : `${tabFilteredProducts.length} ${tabFilteredProducts.length === 1 ? 'product' : 'products'}`}
        filtersBelow
        filters={(
          <>
            <select
              className="admin-control admin-toolbar-select"
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
            <select
              className="admin-control admin-toolbar-select"
              value={archiveTab}
              onChange={(e) => setArchiveTab(e.target.value)}
              aria-label="Filter by listing status"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
            <select
              className="admin-control admin-toolbar-select"
              value={availabilityFilter}
              onChange={(e) => setAvailabilityFilter(e.target.value)}
              aria-label="Filter by availability"
            >
              <option value="all">All availability</option>
              <option value="available">Available</option>
              <option value="sold_out">Sold out</option>
            </select>
          </>
        )}
      />

      {archiveTab === 'archived' && (
        <p className="product-admin-tab-help">
          Archived products are hidden from the storefront and are not shown to customers.
        </p>
      )}
      {availabilityFilter === 'sold_out' && (
        <p className="product-admin-tab-help">
          Sold-out dishes still show on the website and subscription pages — customers just can’t add them to an order.
        </p>
      )}

      {showForm && (
        <ProductForm
          ref={formRef}
          onSubmit={editProduct ? handleUpdateProduct : handleAddProduct}
          onCancel={() => {
            setShowForm(false);
            setEditProduct(null);
          }}
          initialData={editProduct}
          categories={categories}
        />
      )}

      {products.length === 0 ? (
        <p className="product-admin-empty-tab">No products found.</p>
      ) : tabFilteredProducts.length === 0 ? (
        <p className="product-admin-empty-tab">
          {archiveTab !== 'all' || availabilityFilter !== 'all'
            ? 'No products match your search or filters.'
            : 'No products match your search or category filter.'}
        </p>
      ) : (
        <div className="admin-list">
          {tabFilteredProducts.map((product) => {
            const tagNames = getTagNames(product);
            const isAvailable = product.is_available !== false && product.is_available !== 0;
            return (
              <AdminListItem
                key={product.id}
                image={product.image_url}
                title={product.slug}
                description={product.description?.trim() ? product.description : ''}
                price={`$${(product.price_cents / 100).toFixed(2)}`}
                category={getCategoryName(product.category_id) || '—'}
                tags={(
                  <>
                    {tagNames.map((name, i) => (
                      <Badge key={`${name}-${i}`} tone="neutral">{name}</Badge>
                    ))}
                    <Badge tone={isAvailable ? 'success' : 'danger'}>
                      {isAvailable ? 'Available' : 'Sold out'}
                    </Badge>
                    {!product.is_active ? <Badge tone="muted">Archived</Badge> : null}
                  </>
                )}
                actions={(
                  <>
                    <AdminButton
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setEditProduct(product);
                        setShowForm(true);
                        setTimeout(() => {
                          formRef.current?.scrollIntoView({ behavior: 'smooth' });
                        }, 100);
                      }}
                    >
                      Edit
                    </AdminButton>
                    <AdminButton
                      variant={product.is_active ? 'danger' : 'secondary'}
                      size="sm"
                      onClick={() => handleToggleArchive(product)}
                    >
                      {product.is_active ? 'Archive' : 'Unarchive'}
                    </AdminButton>
                  </>
                )}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ProductAdmin;