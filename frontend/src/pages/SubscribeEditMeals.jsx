import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import Lottie from 'lottie-react'
import { Vegan, LeafyGreen, Ham, MilkOff, BeanOff, WheatOff } from 'lucide-react'
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
  bumpMeal,
  emptyEditCart,
  lineQty,
  mealsExact,
  readEditCart,
  seedEditCart,
  sortPlanMealCategories,
  totalQty,
  writeEditCart,
} from '../helpers/subscriptionCart'

const TAG_ICONS = {
  vegan: <Vegan size={16} />,
  vegetarian: <LeafyGreen size={16} />,
  keto: <Ham size={16} />,
  'dairy free': <MilkOff size={16} />,
  paleo: <BeanOff size={16} />,
  'gluten free': <WheatOff size={16} />,
}

const SubscribeEditMeals = ({ user }) => {
  const { subscriptionId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const userId = user?.id
  // Snapshot on first mount so Edit plan can reseed without a URL change (and a second load).
  const [startFresh] = useState(() => location.state?.fresh === true)
  const [row, setRow] = useState(null)
  const [editCart, setEditCart] = useState(emptyEditCart)
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [allTags, setAllTags] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [dialog, setDialog] = useState(null)

  useEffect(() => {
    if (!userId) {
      navigate(`/login?next=${encodeURIComponent(`/my-subscriptions/${subscriptionId}/meals`)}`, { replace: true })
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
            body: 'Active plans can change meals from My Subscriptions.',
            primaryLabel: 'My Subscriptions',
            primaryTo: '/my-subscriptions',
          })
          setIsLoading(false)
          return
        }
        const stored = readEditCart(userId, subscriptionId)
        const source = found.edit_cycle || found.cycle
        const nextCart = startFresh || stored.subscriptionId !== subscriptionId
          ? seedEditCart(found, source)
          : stored
        writeEditCart(userId, subscriptionId, nextCart)
        setRow(found)
        setEditCart(nextCart)
        setProducts(nextProducts || [])
        setCategories(sortPlanMealCategories(nextCategories || []))
        setAllTags(nextTags || [])
        setIsLoading(false)
      })
      .catch((err) => {
        console.error(err)
        if (cancelled) return
        setDialog({
          icon: 'alert',
          title: 'Could not load meals',
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

  const plan = row?.subscription_plans || {}
  const picked = totalQty(editCart.meals)
  const exact = mealsExact(editCart)
  const atCap = Number(editCart.mealCount) > 0 && picked >= Number(editCart.mealCount)

  const getTagNames = (tagIds) =>
    (tagIds || [])
      .map((id) => allTags.find((tag) => tag.id === id))
      .filter(Boolean)
      .map((tag) => tag.name)

  const bump = (product, delta) => {
    setEditCart((prev) => {
      const next = bumpMeal(prev, product, delta)
      writeEditCart(user.id, subscriptionId, next)
      return next
    })
  }

  const onContinue = () => {
    if (!exact) return
    navigate(`/my-subscriptions/${subscriptionId}/addons`)
  }

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
          {row ? (
            <>
              <p className="subscribe-eyebrow">
                {plan.meal_count} meals — {formatPlanPrice(plan.price_cents)}/week
              </p>
              <h1 className="subscribe-h1">Choose your meals</h1>
              <p className="subscribe-subhead">
                Pick any combination of bowls, salads, and mains, up to your plan&apos;s total.
              </p>
              <p className="subscribe-helper">
                <Link className="subscribe-inline-link" to="/my-subscriptions">Back to My Subscriptions</Link>
              </p>

              <SubscribeCatalog
                categories={categories}
                products={products}
                getTagNames={getTagNames}
                tagIcons={TAG_ICONS}
                quantityFor={(product) => lineQty(editCart.meals, product.id)}
                onIncrement={(product) => bump(product, 1)}
                onDecrement={(product) => bump(product, -1)}
                incrementDisabledFor={(product) => atCap || !product.is_available}
              />

              <div className="subscribe-flow-bar">
                <p className="subscribe-progress" aria-live="polite">
                  {picked} of {editCart.mealCount} meals selected
                </p>
                <button
                  type="button"
                  className="subscribe-select-button"
                  disabled={!exact}
                  onClick={onContinue}
                >
                  Continue
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
      <FeedbackDialog dialog={dialog} onClose={() => setDialog(null)} />
    </div>
  )
}

export default SubscribeEditMeals
