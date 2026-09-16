import { useEffect, useState } from 'react'
import { Vegan, LeafyGreen, Ham, MilkOff, BeanOff, WheatOff } from 'lucide-react'
import ProductCard from '../pages/ProductCard'
import '../styles/Products.css'

const SUBSCRIBE_TAG_ICONS = {
  vegan: <Vegan size={12} />,
  vegetarian: <LeafyGreen size={12} />,
  keto: <Ham size={12} />,
  'dairy free': <MilkOff size={12} />,
  paleo: <BeanOff size={12} />,
  'gluten free': <WheatOff size={12} />,
}

function tagNamesFrom(allTags, tagIds) {
  return (tagIds || [])
    .map((id) => (allTags || []).find((tag) => tag.id === id))
    .filter(Boolean)
    .map((tag) => tag.name)
}

/** Menu chips + cards with quantity steppers (meals and add-ons). */
const SubscribeCatalog = ({
  categories,
  products,
  allTags,
  quantityFor,
  onIncrement,
  onDecrement,
  incrementDisabledFor,
  hidePrice = false,
  compactAdd = false,
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
      </div>

      <div className="products-container subscribe-catalog-grid">
        {visible.map((product, index) => (
          <ProductCard
            key={product.id}
            product={product}
            tagIcons={SUBSCRIBE_TAG_ICONS}
            getTagNames={(tagIds) => tagNamesFrom(allTags, tagIds)}
            eager={index < 4}
            quantity={quantityFor(product)}
            onIncrement={onIncrement}
            onDecrement={onDecrement}
            incrementDisabled={incrementDisabledFor(product)}
            hidePrice={hidePrice}
            compactAdd={compactAdd}
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
