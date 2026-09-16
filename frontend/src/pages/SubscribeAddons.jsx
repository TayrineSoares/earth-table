import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Lottie from 'lottie-react'
import '../styles/SubscribeAndSave.css'
import '../styles/Products.css'
import '../styles/SubscribeFlow.css'
import loadingAnimation from '../assets/loading.json'
import SubscribeCatalog from '../components/SubscribeCatalog'
import { formatPlanPrice } from '../helpers/subscriptionHelpers'
import {
  addonCategories,
  addonSubtotalCents,
  lineQty,
  mealsExact,
  totalQty,
} from '../helpers/subscriptionCart'

const SubscribeAddons = ({ subCart, bumpSubAddon }) => {
  const { planId } = useParams()
  const navigate = useNavigate()
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [allTags, setAllTags] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!subCart.planId || subCart.planId !== planId || !mealsExact(subCart)) {
      navigate(`/subscribe/${planId}/meals`, { replace: true })
    }
  }, [planId, subCart, navigate])

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch('/api/products').then((res) => {
        if (!res.ok) throw new Error('Could not load products')
        return res.json()
      }),
      fetch('/api/categories').then((res) => {
        if (!res.ok) throw new Error('Could not load categories')
        return res.json()
      }),
      fetch('/api/tags').then((res) => res.json()).catch(() => []),
    ])
      .then(([nextProducts, nextCategories, nextTags]) => {
        if (cancelled) return
        setProducts(nextProducts || [])
        setCategories(addonCategories(nextCategories || []))
        setAllTags(nextTags || [])
        setIsLoading(false)
      })
      .catch((err) => {
        console.error(err)
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const addonCents = addonSubtotalCents(subCart)
  const extraCount = totalQty(subCart.addons)
  const extraLine = addonCents > 0
    ? `Add-on subtotal: $${(addonCents / 100).toFixed(2)}`
    : extraCount > 0
      ? `${extraCount} extra${extraCount === 1 ? '' : 's'}`
      : 'No extras yet'
  const goToCart = () => navigate('/subscribe/cart')

  if (isLoading) {
    return (
      <div className="subscribe-page">
        <div className="page-wrapper">
          <div className="subscribe-loading">
            <Lottie animationData={loadingAnimation} loop />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="subscribe-page subscribe-flow-page">
      <div className="page-wrapper">
        <div className="subscribe-content">
          <h1 className="subscribe-h1 subscribe-choose-title">Add extras</h1>
          <p className="subscribe-plan-line">
            {subCart.mealCount} meals · {formatPlanPrice(subCart.priceCents)}/week ·{' '}
            <Link className="subscribe-inline-link" to={`/subscribe/${planId}/meals`}>
              Back to meals
            </Link>
          </p>
          <p className="subscribe-subhead">
            Top off this week with snacks, smoothies, or anything else on the menu.
          </p>
          <p className="subscribe-helper">
            Extras won&apos;t repeat next week.
          </p>

          <SubscribeCatalog
            categories={categories}
            products={products}
            allTags={allTags}
            quantityFor={(product) => lineQty(subCart.addons, product.id)}
            onIncrement={(product) => bumpSubAddon(product, 1)}
            onDecrement={(product) => bumpSubAddon(product, -1)}
            incrementDisabledFor={(product) => !product.is_available}
            compactAdd
          />

          <div className="subscribe-flow-bar">
            <p className="subscribe-progress" aria-live="polite">
              {extraLine}
            </p>
            <div className="subscribe-flow-bar-actions">
              <button type="button" className="subscribe-text-button" onClick={goToCart}>
                Skip
              </button>
              <button type="button" className="subscribe-select-button" onClick={goToCart}>
                Continue
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SubscribeAddons
