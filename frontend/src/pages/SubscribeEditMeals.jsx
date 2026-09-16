import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
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
  updateSubscriptionMeals,
} from '../helpers/subscriptionHelpers'
import {
  bumpMeal,
  lineQty,
  mealsExact,
  sortPlanMealCategories,
  totalQty,
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
  const [row, setRow] = useState(null)
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [allTags, setAllTags] = useState([])
  const [meals, setMeals] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dialog, setDialog] = useState(null)

  useEffect(() => {
    if (!user?.id) {
      navigate(`/login?next=${encodeURIComponent(`/my-subscriptions/${subscriptionId}/meals`)}`, { replace: true })
    }
  }, [user, navigate, subscriptionId])

  useEffect(() => {
    if (!user?.id) return undefined
    let cancelled = false
    setIsLoading(true)

    Promise.all([
      fetchMySubscriptions(user.id),
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
            title: 'This week is locked',
            body: 'Meals can only change before Thursday at 5:00 PM.',
            primaryLabel: 'My Subscriptions',
            primaryTo: '/my-subscriptions',
          })
          setIsLoading(false)
          return
        }
        const cycleItems = (found.cycle?.subscription_cycle_items || [])
          .filter((item) => item.kind === 'plan')
        const seeded = cycleItems.map((item) => ({
          id: item.product_id,
          slug: item.products?.slug || '',
          image_url: item.products?.image_url || '',
          price_cents: item.unit_price_cents,
          quantity: item.quantity,
        }))
        setRow(found)
        setProducts(nextProducts || [])
        setCategories(sortPlanMealCategories(nextCategories || []))
        setAllTags(nextTags || [])
        setMeals(seeded)
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
  }, [user, subscriptionId])

  const plan = row?.subscription_plans || {}
  const mealCount = Number(plan.meal_count) || 0
  const cart = { mealCount, meals }
  const picked = totalQty(meals)
  const exact = mealsExact(cart)
  const atCap = mealCount > 0 && picked >= mealCount

  const getTagNames = (tagIds) =>
    (tagIds || [])
      .map((id) => allTags.find((tag) => tag.id === id))
      .filter(Boolean)
      .map((tag) => tag.name)

  const onSave = async () => {
    if (!exact || saving) return
    setSaving(true)
    try {
      await updateSubscriptionMeals(
        user.id,
        subscriptionId,
        meals.map((item) => ({ id: item.id, quantity: item.quantity }))
      )
      navigate('/my-subscriptions')
    } catch (err) {
      console.error(err)
      setSaving(false)
      setDialog({
        icon: 'alert',
        title: 'Could not save meals',
        body: err.message || 'Try again in a moment.',
        primaryLabel: 'OK',
      })
    }
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
              <h1 className="subscribe-h1">Edit this week&apos;s meals</h1>
              <p className="subscribe-subhead">
                Changes apply to this Sunday only. Add-ons stay as they are.
              </p>
              <p className="subscribe-helper">
                <Link className="subscribe-inline-link" to="/my-subscriptions">Back to My Subscriptions</Link>
              </p>

              <SubscribeCatalog
                categories={categories}
                products={products}
                getTagNames={getTagNames}
                tagIcons={TAG_ICONS}
                quantityFor={(product) => lineQty(meals, product.id)}
                onIncrement={(product) => setMeals((prev) => bumpMeal({ mealCount, meals: prev }, product, 1).meals)}
                onDecrement={(product) => setMeals((prev) => bumpMeal({ mealCount, meals: prev }, product, -1).meals)}
                incrementDisabledFor={(product) => atCap || !product.is_available}
              />

              <div className="subscribe-flow-bar">
                <p className="subscribe-progress" aria-live="polite">
                  {picked} of {mealCount} meals selected
                </p>
                <button
                  type="button"
                  className="subscribe-select-button"
                  disabled={!exact || saving}
                  onClick={onSave}
                >
                  {saving ? 'Saving…' : 'Save meals'}
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
