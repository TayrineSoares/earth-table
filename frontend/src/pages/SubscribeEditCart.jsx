import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Lottie from 'lottie-react'
import checkoutImage from '../assets/images/checkoutImage.png'
import loadingAnimation from '../assets/loading.json'
import FeedbackDialog from '../components/FeedbackDialog'
import '../styles/Cart.css'
import '../styles/SubscribeFlow.css'
import {
  fetchMySubscriptions,
  formatPlanPrice,
  updateSubscriptionItems,
  weekSaveCopy,
} from '../helpers/subscriptionHelpers'
import {
  addonSubtotalCents,
  clearEditCart,
  emptyEditCart,
  mealsExact,
  readEditCart,
} from '../helpers/subscriptionCart'

const SubscribeEditCart = ({ user }) => {
  const { subscriptionId } = useParams()
  const navigate = useNavigate()
  const [row, setRow] = useState(null)
  const [editCart, setEditCart] = useState(emptyEditCart)
  const [isLoading, setIsLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dialog, setDialog] = useState(null)

  useEffect(() => {
    if (!user?.id) {
      navigate(`/login?next=${encodeURIComponent(`/my-subscriptions/${subscriptionId}/cart`)}`, { replace: true })
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
    fetchMySubscriptions(user.id)
      .then((subs) => {
        if (cancelled) return
        const found = (subs || []).find((item) => item.id === subscriptionId)
        if (!found?.can_edit) {
          setDialog({
            icon: 'alert',
            title: found ? 'This plan is paused' : 'Subscription not found',
            body: found
              ? 'Active plans can change meals from My Subscriptions.'
              : 'That plan is not on this account.',
            primaryLabel: 'My Subscriptions',
            primaryTo: '/my-subscriptions',
          })
          setIsLoading(false)
          return
        }
        setRow(found)
        setIsLoading(false)
      })
      .catch((err) => {
        console.error(err)
        if (cancelled) return
        setDialog({
          icon: 'alert',
          title: 'Could not load your plan',
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

  const addonCents = addonSubtotalCents(editCart)
  const copy = weekSaveCopy(row?.week, {
    lockedPriorCycle: Boolean(
      row?.this_week_cycle
      && (row.this_week_cycle.status === 'locked' || row.this_week_cycle.status === 'skipped')
    ),
  })

  const persist = async () => {
    setSaving(true)
    setDialog(null)
    try {
      await updateSubscriptionItems(
        user.id,
        subscriptionId,
        editCart.meals.map((item) => ({ id: item.id, quantity: item.quantity })),
        editCart.addons.map((item) => ({ id: item.id, quantity: item.quantity }))
      )
      clearEditCart(user.id, subscriptionId)
      navigate('/my-subscriptions', { state: { saved: true } })
    } catch (err) {
      console.error(err)
      setSaving(false)
      setDialog({
        icon: 'alert',
        title: 'Could not save your plan',
        body: err.message || 'Try again in a moment.',
        primaryLabel: 'OK',
      })
    }
  }

  const onConfirm = () => {
    if (saving) return
    setDialog({
      icon: 'mail',
      title: copy.title,
      body: `${copy.body} Add-ons are a one-time extra for that Sunday and will not repeat the following week.`,
      primaryLabel: 'Save changes',
      secondaryLabel: 'Cancel',
      onPrimary: persist,
    })
  }

  if (isLoading) {
    return (
      <div
        className="loading-container"
        style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <Lottie animationData={loadingAnimation} loop />
      </div>
    )
  }

  return (
    <div className="checkout-page subscribe-cart-page">
      <div className="checkout-page-header-image">
        <img src={checkoutImage} className="checkout-image" alt="" />
      </div>

      <div className="page-wrapper">
        <div className="checkout-page-container">
          <div className="checkout-order-summary">
            <p className="checkout-summary-text">Your weekly plan</p>
            <p className="general-text" style={{ margin: '0 0 16px' }}>{copy.body}</p>

            <p className="subscribe-summary-heading">Weekly Plan</p>
            <div className="checkout-summary-subtotal">
              <p className="subtotal">
                {editCart.mealCount} {Number(editCart.mealCount) === 1 ? 'meal' : 'meals'} plan
              </p>
              <p className="subtotal">{formatPlanPrice(editCart.priceCents)}</p>
            </div>
            <p className="subscribe-summary-heading">Add-ons</p>
            {editCart.addons.length === 0 ? (
              <p className="subscribe-summary-empty">None this week.</p>
            ) : (
              editCart.addons.map((item) => (
                <div className="checkout-summary-subtotal" key={`sum-addon-${item.id}`}>
                  <p className="subtotal">
                    {item.slug}
                    {item.quantity > 1 ? ` × ${item.quantity}` : ''}
                  </p>
                  <p className="subtotal">
                    ${((item.price_cents * item.quantity) / 100).toFixed(2)}
                  </p>
                </div>
              ))
            )}
            {addonCents > 0 ? (
              <div className="checkout-summary-subtotal">
                <p className="subtotal">Add-on subtotal</p>
                <p className="subtotal">{formatPlanPrice(addonCents)}</p>
              </div>
            ) : null}

            <button
              type="button"
              className="checkout-button"
              disabled={saving}
              onClick={onConfirm}
            >
              {saving ? 'Saving…' : 'Confirm changes'}
            </button>
          </div>

          <div className="checkout-items subscribe-cart-items">
            <div className="subscribe-cart-heading-row">
              <p className="subscribe-list-heading">Your Weekly Plan</p>
              <Link className="subscribe-inline-link" to={`/my-subscriptions/${subscriptionId}/meals`}>
                Edit meals
              </Link>
            </div>
            {editCart.meals.map((item) => (
              <div className="checkout-items-container" key={`meal-${item.id}`}>
                {item.image_url ? (
                  <img src={item.image_url} className="checkout-product-image" alt={item.slug} />
                ) : (
                  <div className="checkout-product-image" style={{ background: '#f2f2f2' }} />
                )}
                <div className="checkout-item-details">
                  <p className="checkout-item-title">{item.slug}</p>
                  {item.quantity > 1 ? (
                    <p className="checkout-item-price">qty {item.quantity}</p>
                  ) : null}
                </div>
              </div>
            ))}

            <div className="subscribe-cart-heading-row">
              <p className="subscribe-list-heading">This Week Add-ons</p>
              <Link className="subscribe-inline-link" to={`/my-subscriptions/${subscriptionId}/addons`}>
                Edit add-ons
              </Link>
            </div>
            {editCart.addons.length === 0 ? (
              <p className="general-text">No add-ons this week.</p>
            ) : (
              editCart.addons.map((item) => (
                <div className="checkout-items-container" key={`addon-${item.id}`}>
                  {item.image_url ? (
                    <img src={item.image_url} className="checkout-product-image" alt={item.slug} />
                  ) : (
                    <div className="checkout-product-image" style={{ background: '#f2f2f2' }} />
                  )}
                  <div className="checkout-item-details">
                    <p className="checkout-item-title">{item.slug}</p>
                    <p className="checkout-item-price">
                      {item.quantity > 1 ? `Add-on · qty ${item.quantity}` : 'Add-on'}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      <FeedbackDialog dialog={dialog} onClose={() => setDialog(null)} />
    </div>
  )
}

export default SubscribeEditCart
