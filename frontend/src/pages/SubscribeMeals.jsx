import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Lottie from 'lottie-react'
import '../styles/SubscribeAndSave.css'
import '../styles/Products.css'
import '../styles/SubscribeFlow.css'
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
  }, [planId])

  const picked = totalQty(subCart.meals)
  const need = Number(subCart.mealCount) || 0
  const exact = mealsExact(subCart)
  const atCap = need > 0 && picked >= need
  const sundayLabel = dates?.first_delivery_label || ''
  const cutoffLabel = dates?.cutoff_label || 'Thursday at 5:00 PM'
  const trackPct = need > 0 ? Math.min(100, Math.round((picked / need) * 100)) : 0

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
              <h1 className="subscribe-h1 subscribe-choose-title">Choose your meals</h1>
              <p className="subscribe-plan-line">
                {plan.meal_count} meals · {formatPlanPrice(plan.price_cents)}/week ·{' '}
                <Link className="subscribe-inline-link" to="/subscribe-and-save">Change plan</Link>
              </p>
              <p className={dates?.cutoff_passed ? 'subscribe-cutoff-note' : 'subscribe-subhead'}>
                {dates?.cutoff_passed
                  ? `This week's cutoff has passed. Mix bowls, salads, and main plates however you like for ${sundayLabel}.`
                  : `Mix bowls, salads, and main plates however you like — change anything until ${cutoffLabel}.`}
              </p>
              <div
                className="subscribe-meal-track"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={need}
                aria-valuenow={picked}
                aria-label={`${picked} of ${need} meals chosen`}
              >
                <span className="subscribe-meal-track-fill" style={{ width: `${trackPct}%` }} />
              </div>
              <p className="subscribe-meal-count" aria-live="polite">
                {picked} of {need} chosen{sundayLabel ? ` for ${sundayLabel}` : ''}
              </p>

              <SubscribeCatalog
                categories={categories}
                products={products}
                allTags={allTags}
                quantityFor={(product) => lineQty(subCart.meals, product.id)}
                onIncrement={(product) => bumpSubMeal(product, 1)}
                onDecrement={(product) => bumpSubMeal(product, -1)}
                incrementDisabledFor={(product) => atCap || !product.is_available}
                hidePrice
                compactAdd
              />

              <div className="subscribe-flow-bar">
                <p className="subscribe-progress" aria-live="polite">
                  {picked} of {need} meals selected
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

export default SubscribeMeals
