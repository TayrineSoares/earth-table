import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Lottie from 'lottie-react'
import { Vegan, LeafyGreen, Ham, MilkOff, BeanOff, WheatOff } from 'lucide-react'
import '../styles/SubscribeAndSave.css'
import '../styles/SubscribeFlow.css'
import '../styles/Products.css'
import loadingAnimation from '../assets/loading.json'
import FeedbackDialog from '../components/FeedbackDialog'
import SubscribeCatalog from '../components/SubscribeCatalog'
import {
  fetchSubscriptionPlan,
  fetchSubscriptionDates,
  formatPlanPrice,
} from '../helpers/subscriptionHelpers'
import {
  applyPlanToCart,
  lineQty,
  totalQty,
  mealsExact,
  sortPlanMealCategories,
} from '../helpers/subscriptionCart'

const TAG_ICONS = {
  vegan: <Vegan size={16} />,
  vegetarian: <LeafyGreen size={16} />,
  keto: <Ham size={16} />,
  'dairy free': <MilkOff size={16} />,
  paleo: <BeanOff size={16} />,
  'gluten free': <WheatOff size={16} />,
}

const SubscribeMeals = ({ subCart, setSubCart, bumpSubMeal }) => {
  const { planId } = useParams()
  const navigate = useNavigate()
  const [plan, setPlan] = useState(null)
  const [dates, setDates] = useState(null)
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [allTags, setAllTags] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [dialog, setDialog] = useState(null)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)

    Promise.all([
      fetchSubscriptionPlan(planId),
      fetchSubscriptionDates(),
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
      .then(([nextPlan, nextDates, nextProducts, nextCategories, nextTags]) => {
        if (cancelled) return
        if (!nextPlan.is_active) {
          setDialog({
            icon: 'alert',
            title: 'This plan is not available',
            body: 'That plan is no longer offered. Pick another from Subscribe & Save.',
            primaryLabel: 'See plans',
            primaryTo: '/subscribe-and-save',
          })
          setIsLoading(false)
          return
        }
        setPlan(nextPlan)
        setDates(nextDates)
        setProducts(nextProducts || [])
        setCategories(sortPlanMealCategories(nextCategories || []))
        setAllTags(nextTags || [])
        setSubCart((prev) => applyPlanToCart(prev, nextPlan))
        setIsLoading(false)
      })
      .catch((err) => {
        console.error(err)
        if (cancelled) return
        setDialog({
          icon: 'alert',
          title: 'Could not load this plan',
          body: err.message || 'Try again from Subscribe & Save.',
          primaryLabel: 'See plans',
          primaryTo: '/subscribe-and-save',
        })
        setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [planId, setSubCart])

  const getTagNames = (tagIds) =>
    (tagIds || [])
      .map((id) => allTags.find((tag) => tag.id === id))
      .filter(Boolean)
      .map((tag) => tag.name)

  const picked = totalQty(subCart.meals)
  const need = Number(subCart.mealCount) || 0
  const exact = mealsExact(subCart)
  const atCap = need > 0 && picked >= need

  const onContinue = () => {
    if (!exact) return
    navigate(`/subscribe/${planId}/addons`)
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
          {plan ? (
            <>
              <p className="subscribe-eyebrow">
                {plan.meal_count} meals — {formatPlanPrice(plan.price_cents)}/week
              </p>
              <h1 className="subscribe-h1">Choose your meals</h1>
              <p className="subscribe-subhead">
                Pick any combination of bowls, salads, and mains, up to your plan&apos;s total.
              </p>
              <p className="subscribe-helper">
                <Link className="subscribe-inline-link" to="/subscribe-and-save">Change plan</Link>
              </p>
              {dates ? (
                <p className={dates.cutoff_passed ? 'subscribe-cutoff-note' : 'subscribe-helper'}>
                  {dates.cutoff_passed
                    ? `This week's cutoff has passed. First delivery: ${dates.first_delivery_label}.`
                    : `First delivery: ${dates.first_delivery_label}.`}
                </p>
              ) : null}

              <p className="subscribe-progress" aria-live="polite">
                {picked} of {need} meals selected
              </p>

              <SubscribeCatalog
                categories={categories}
                products={products}
                getTagNames={getTagNames}
                tagIcons={TAG_ICONS}
                quantityFor={(product) => lineQty(subCart.meals, product.id)}
                onIncrement={(product) => bumpSubMeal(product, 1)}
                onDecrement={(product) => bumpSubMeal(product, -1)}
                incrementDisabledFor={(product) => atCap || !product.is_available}
              />

              <div className="subscribe-flow-bar">
                <p className="subscribe-progress">{picked} of {need} meals selected</p>
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

export default SubscribeMeals
