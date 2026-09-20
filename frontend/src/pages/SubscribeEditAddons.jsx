import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import Lottie from 'lottie-react'
import '../styles/SubscribeAndSave.css'
import '../styles/Products.css'
import '../styles/SubscribeFlow.css'
import loadingAnimation from '../assets/loading.json'
import FeedbackDialog from '../components/FeedbackDialog'
import SubscribeCatalog from '../components/SubscribeCatalog'
import {
  fetchMySubscriptions,
  formatPlanPrice,
} from '../helpers/subscriptionHelpers'
import {
  addonCategories,
  addonSubtotalCents,
  bumpAddon,
  emptyEditCart,
  lineQty,
  mealsExact,
  readEditCart,
  seedEditCart,
  totalQty,
  writeEditCart,
} from '../helpers/subscriptionCart'

const SubscribeEditAddons = ({ user }) => {
  const { subscriptionId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const userId = user?.id
  const [startFresh] = useState(() => location.state?.fresh === true)
  const [editCart, setEditCart] = useState(emptyEditCart)
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [allTags, setAllTags] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [dialog, setDialog] = useState(null)

  useEffect(() => {
    if (!userId) {
      navigate(`/login?next=${encodeURIComponent(`/my-subscriptions/${subscriptionId}/addons`)}`, { replace: true })
    }
  }, [userId, navigate, subscriptionId])

  useEffect(() => {
    if (!userId) return undefined
    let cancelled = false

    Promise.all([
      fetchMySubscriptions(userId),
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
      .then(([subs, nextProducts, nextCategories, nextTags]) => {
        if (cancelled) return
        const found = (subs || []).find((item) => item.id === subscriptionId)
        if (!found) {
          setDialog({
            icon: 'alert',
            title: 'Subscription not found',
            body: 'That plan is not on this account.',
            primaryLabel: 'My Subscriptions',
            primaryTo: '/my-subscriptions',
          })
          setIsLoading(false)
          return
        }
        if (!found.can_edit) {
          setDialog({
            icon: 'alert',
            title: 'This plan is paused',
            body: 'Active plans can change extras from My Subscriptions.',
            primaryLabel: 'My Subscriptions',
            primaryTo: '/my-subscriptions',
          })
          setIsLoading(false)
          return
        }
        const stored = readEditCart(userId, subscriptionId)
        const source = found.edit_cycle || found.cycle
        const nextCart = startFresh || stored.subscriptionId !== subscriptionId || !mealsExact(stored)
          ? seedEditCart(found, source)
          : stored
        writeEditCart(userId, subscriptionId, nextCart)
        setEditCart(nextCart)
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
  }, [userId, subscriptionId, startFresh])

  const bump = (product, delta) => {
    setEditCart((prev) => {
      const next = bumpAddon(prev, product, delta)
      writeEditCart(userId, subscriptionId, next)
      return next
    })
  }

  const goToCart = () => navigate(`/my-subscriptions/${subscriptionId}/cart`)
  const addonCents = addonSubtotalCents(editCart)
  const extraCount = totalQty(editCart.addons)
  const extraLine = addonCents > 0
    ? `Add-on subtotal: $${(addonCents / 100).toFixed(2)}`
    : extraCount > 0
      ? `${extraCount} extra${extraCount === 1 ? '' : 's'}`
      : 'No extras yet'

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
            {editCart.mealCount} meals · {formatPlanPrice(editCart.priceCents)}/week ·{' '}
            <Link className="subscribe-inline-link" to={`/my-subscriptions/${subscriptionId}/meals`}>
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
            quantityFor={(product) => lineQty(editCart.addons, product.id)}
            onIncrement={(product) => bump(product, 1)}
            onDecrement={(product) => bump(product, -1)}
            incrementDisabledFor={(product) => !product.is_available}
            compactAdd
          />

          <div className="subscribe-flow-bar">
            <p className="subscribe-progress" aria-live="polite">
              {extraLine}
            </p>
            <div className="subscribe-flow-bar-actions">
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
