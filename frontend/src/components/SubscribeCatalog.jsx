import { useEffect, useState } from 'react'
import ProductCard from '../pages/ProductCard'
import '../styles/Products.css'

/** Menu chips + cards with quantity steppers (meals and add-ons). */
const SubscribeCatalog = ({
  categories,
  products,
  getTagNames,
  tagIcons,
  quantityFor,
  onIncrement,
  onDecrement,
  incrementDisabledFor,
}) => {
  const [selectedId, setSelectedId] = useState(null)

  useEffect(() => {
    if (!categories.length) {
      setSelectedId(null)
      return
    }
    const stillThere = categories.some((cat) => cat.id === selectedId)
    if (!stillThere) setSelectedId(categories[0].id)
  }, [categories, selectedId])

  const selected = categories.find((cat) => cat.id === selectedId) || null
  const visible = products.filter((product) => {
    if (!product.is_active) return false
    if (selectedId == null) return true
    return product.category_id === selectedId
  })

  return (
    <>
      <div className="categories-container">
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            className={`categories${selectedId === category.id ? ' is-selected' : ''}`}
            onClick={() => setSelectedId(category.id)}
          >
            {category.name}
          </button>
        ))}
      </div>

      <div className="category-title-container-2">
        <p className="category-title-2">{selected ? selected.name : 'Menu'}</p>
        {selected?.description?.trim() ? (
          <p className="category-description">{selected.description.trim()}</p>
        ) : null}
      </div>

      <div className="products-container">
        {visible.map((product, index) => (
          <ProductCard
            key={product.id}
            product={product}
            tagIcons={tagIcons}
            getTagNames={getTagNames}
            eager={index < 3}
            quantity={quantityFor(product)}
            onIncrement={onIncrement}
            onDecrement={onDecrement}
            incrementDisabled={incrementDisabledFor(product)}
          />
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="subscribe-empty">Nothing in this category right now.</p>
      ) : null}
    </>
  )
}

export default SubscribeCatalog
