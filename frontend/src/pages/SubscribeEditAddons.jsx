import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Lottie from 'lottie-react'
import '../styles/SubscribeAndSave.css'
import '../styles/Products.css'
import '../styles/SubscribeFlow.css'
import loadingAnimation from '../assets/loading.json'
import FeedbackDialog from '../components/FeedbackDialog'
import SubscribeCatalog from '../components/SubscribeCatalog'
import { formatPlanPrice } from '../helpers/subscriptionHelpers'
import {
  addonCategories,
  addonSubtotalCents,
  bumpAddon,
  emptyEditCart,
  lineQty,
  mealsExact,
  readEditCart,
  writeEditCart,
} from '../helpers/subscriptionCart'

const SubscribeEditAddons = ({ user }) => {
  const { subscriptionId } = useParams()
  const navigate = useNavigate()
  const [editCart, setEditCart] = useState(emptyEditCart)
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [allTags, setAllTags] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [dialog, setDialog] = useState(null)

  useEffect(() => {
    if (!user?.id) {
      navigate(`/login?next=${encodeURIComponent(`/my-subscriptions/${subscriptionId}/addons`)}`, { replace: true })
    }
  }, [user, navigate, subscriptionId])

  useEffect(() => {
    if (!user?.id) return undefined
    const stored = readEditCart(user.id, subscriptionId)
    if (!stored.subscriptionId || !mealsExact(stored)) {
      navigate(`/my-subscriptions/${subscriptionId}/meals`, { replace: true })
      return undefined
    }
    setEditCart(stored)

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
        if (cancelled) return
        setDialog({
          icon: 'alert',
          title: 'Could not load add-ons',
          body: err.message || 'Try again from My Subscriptions.',
          primaryLabel: 'My Subscriptions',
          primaryTo: '/my-subscriptions',
        })
        setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [user, subscriptionId, navigate])

  const bump = (product, delta) => {
    setEditCart((prev) => {
      const next = bumpAddon(prev, product, delta)
      writeEditCart(user.id, subscriptionId, next)
      return next
    })
  }

  const goToCart = () => navigate(`/my-subscriptions/${subscriptionId}/cart`)
  const addonCents = addonSubtotalCents(editCart)

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
          <p className="subscribe-eyebrow">
            {editCart.planName || 'Your plan'} — {formatPlanPrice(editCart.priceCents)}/week
          </p>
          <h1 className="subscribe-h1">Add anything extra to this week&apos;s order</h1>
          <p className="subscribe-subhead">
            Add-ons are a one-time addition and won&apos;t repeat next week.
          </p>
          <p className="subscribe-helper">
            <Link className="subscribe-inline-link" to={`/my-subscriptions/${subscriptionId}/meals`}>
              Back to meals
            </Link>
          </p>

          <SubscribeCatalog
            categories={categories}
            products={products}
            allTags={allTags}
            quantityFor={(product) => lineQty(editCart.addons, product.id)}
            onIncrement={(product) => bump(product, 1)}
            onDecrement={(product) => bump(product, -1)}
            incrementDisabledFor={(product) => !product.is_available}
          />

          <div className="subscribe-flow-bar">
            <p className="subscribe-progress" aria-live="polite">
              Add-on subtotal: ${(addonCents / 100).toFixed(2)}
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
      <FeedbackDialog dialog={dialog} onClose={() => setDialog(null)} />
    </div>
  )
}

export default SubscribeEditAddons
