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
import { MEAL_LOCK_BY } from '../helpers/subscriptionCadence'
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

const SubscribeEditMeals = ({ user }) => {
  const { subscriptionId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const userId = user?.id
  // Snapshot on first mount so Edit plan can reseed without a URL change (and a second load).
  const [startFresh] = useState(() => location.state?.fresh === true)
  const [planChangeFlow] = useState(() => location.state?.planChange === true)
  const [resumeAfter] = useState(() => location.state?.resumeAfter === true)
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
        if (!found.can_edit && !planChangeFlow) {
          setDialog({
            icon: 'alert',
            title: 'This box is locked',
            body: `Meals can be changed until ${MEAL_LOCK_BY} while the box is still open.`,
            primaryLabel: 'My Subscriptions',
            primaryTo: '/my-subscriptions',
          })
          setIsLoading(false)
          return
        }
        const stored = readEditCart(userId, subscriptionId)
        const source = found.edit_cycle || found.cycle
        const keepPlanChange = Boolean(
          !startFresh
          && stored.planChangeId
          && stored.subscriptionId === subscriptionId
        )
        const nextCart = keepPlanChange
          ? stored
          : (startFresh || stored.subscriptionId !== subscriptionId
            ? seedEditCart(found, source)
            : stored)
        if (planChangeFlow && !nextCart.planChangeId) {
          setDialog({
            icon: 'alert',
            title: 'Start the plan change again',
            body: 'Choose a plan from My Subscriptions, then confirm your meals to finish the switch.',
            primaryLabel: 'My Subscriptions',
            primaryTo: '/my-subscriptions',
          })
          setIsLoading(false)
          return
        }
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
  }, [userId, subscriptionId, startFresh, planChangeFlow])

  const plan = row?.subscription_plans || {}
  const changingPlan = Boolean(editCart.planChangeId)
  const picked = totalQty(editCart.meals)
  const need = Number(editCart.mealCount) || 0
  const exact = mealsExact(editCart)
  const overCount = need > 0 && picked > need
  const underCount = need > 0 && picked < need
  const atCap = need > 0 && picked >= need
  const sundayLabel = row?.week?.delivery_label || ''
  const cutoffLabel = row?.week?.cutoff_label || MEAL_LOCK_BY
  const trackPct = need > 0 ? Math.min(100, Math.round((picked / need) * 100)) : 0
  const planLineCount = changingPlan ? need : (Number(plan.meal_count) || need)
  const planLinePrice = changingPlan ? editCart.priceCents : plan.price_cents
  const removeCount = overCount ? picked - need : 0

  const bump = (product, delta) => {
    setEditCart((prev) => {
      const next = bumpMeal(prev, product, delta)
      writeEditCart(userId, subscriptionId, next)
      return next
    })
  }

  const onContinue = () => {
    if (!exact) return
    navigate(`/my-subscriptions/${subscriptionId}/addons`, {
      state: resumeAfter ? { resumeAfter: true } : undefined,
    })
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
              <h1 className="subscribe-h1 subscribe-choose-title">
                {changingPlan || resumeAfter ? 'Review your meals' : 'Choose your meals'}
              </h1>
              <p className="subscribe-plan-line">
                {planLineCount} meals · {formatPlanPrice(planLinePrice)}/week ·{' '}
                <Link className="subscribe-inline-link" to="/my-subscriptions">Back to My Subscriptions</Link>
              </p>
              <p className={(overCount || (!changingPlan && row.week?.cutoff_passed)) ? 'subscribe-cutoff-note' : 'subscribe-subhead'}>
                {overCount
                  ? `You're switching to ${need} meals a week but this box still has ${picked}. Remove ${removeCount} meal${removeCount === 1 ? '' : 's'} to continue.`
                  : changingPlan
                    ? (editCart.planChangePending
                      ? `You're switching to ${need} meals a week. Review and leave exactly ${need} for the following week — the plan change only saves when you confirm.`
                      : `You're switching to ${need} meals a week. Review and leave exactly ${need} for ${sundayLabel || 'this Sunday'} — the plan change only saves when you confirm.`)
                    : resumeAfter
                      ? `Review this box and leave exactly ${need} meal${need === 1 ? '' : 's'}. The plan resumes after you save.`
                      : row.week?.cutoff_passed
                        ? `This week's cutoff has passed. Mix bowls, salads, main plates, and soups however you like for ${sundayLabel}.`
                        : `Mix bowls, salads, main plates, and soups however you like — change anything until ${cutoffLabel}.`}
              </p>
              <div
                className="subscribe-meal-track"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={need}
                aria-valuenow={Math.min(picked, need)}
                aria-label={`${picked} of ${need} meals chosen`}
              >
                <span className="subscribe-meal-track-fill" style={{ width: `${trackPct}%` }} />
              </div>
              <p className="subscribe-meal-count" aria-live="polite">
                {picked} of {need} chosen{sundayLabel ? ` for ${sundayLabel}` : ''}
                {overCount ? ` — remove ${removeCount}` : underCount ? ` — add ${need - picked}` : ''}
              </p>

              <SubscribeCatalog
                categories={categories}
                products={products}
                allTags={allTags}
                quantityFor={(product) => lineQty(editCart.meals, product.id)}
                onIncrement={(product) => bump(product, 1)}
                onDecrement={(product) => bump(product, -1)}
                incrementDisabledFor={(product) => atCap || !product.is_available}
                hidePrice
                compactAdd
              />

              <div className="subscribe-flow-bar">
                <p className="subscribe-progress" aria-live="polite">
                  {overCount
                    ? `Remove ${removeCount} meal${removeCount === 1 ? '' : 's'} to continue`
                    : underCount
                      ? `Add ${need - picked} more meal${need - picked === 1 ? '' : 's'} to continue`
                      : `${picked} of ${need} meals selected`}
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
