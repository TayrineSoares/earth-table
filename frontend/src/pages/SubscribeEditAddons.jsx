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
  updateSubscriptionAddons,
  weekSaveCopy,
} from '../helpers/subscriptionHelpers'
import {
  addonCategories,
  bumpAddon,
  lineQty,
} from '../helpers/subscriptionCart'

const TAG_ICONS = {
  vegan: <Vegan size={16} />,
  vegetarian: <LeafyGreen size={16} />,
  keto: <Ham size={16} />,
  'dairy free': <MilkOff size={16} />,
  paleo: <BeanOff size={16} />,
  'gluten free': <WheatOff size={16} />,
}

function seedAddons(cycle) {
  return (cycle?.subscription_cycle_items || [])
    .filter((item) => item.kind === 'addon')
    .map((item) => ({
      id: item.product_id,
      slug: item.products?.slug || '',
      image_url: item.products?.image_url || '',
      price_cents: item.unit_price_cents,
      quantity: item.quantity,
    }))
}

const SubscribeEditAddons = ({ user }) => {
  const { subscriptionId } = useParams()
  const navigate = useNavigate()
  const [row, setRow] = useState(null)
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [allTags, setAllTags] = useState([])
  const [addons, setAddons] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dialog, setDialog] = useState(null)

  useEffect(() => {
    if (!user?.id) {
      navigate(`/login?next=${encodeURIComponent(`/my-subscriptions/${subscriptionId}/addons`)}`, { replace: true })
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
        if (!found || !found.can_edit) {
          setDialog({
            icon: 'alert',
            title: found ? 'This plan is paused' : 'Subscription not found',
            body: found
              ? 'Active plans can add extras from My Subscriptions.'
              : 'That plan is not on this account.',
            primaryLabel: 'My Subscriptions',
            primaryTo: '/my-subscriptions',
          })
          setIsLoading(false)
          return
        }
        setRow(found)
        setProducts(nextProducts || [])
        setCategories(addonCategories(nextCategories || []))
        setAllTags(nextTags || [])
        setAddons(seedAddons(found.edit_cycle || found.cycle))
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
  }, [user, subscriptionId])

  const plan = row?.subscription_plans || {}
  const copy = weekSaveCopy(row?.week)
  const addonCents = addons.reduce(
    (sum, line) => sum + (Number(line.price_cents) || 0) * (Number(line.quantity) || 0),
    0
  )

  const getTagNames = (tagIds) =>
    (tagIds || [])
      .map((id) => allTags.find((tag) => tag.id === id))
      .filter(Boolean)
      .map((tag) => tag.name)

  const saveAddons = async () => {
    setSaving(true)
    setDialog(null)
    try {
      await updateSubscriptionAddons(
        user.id,
        subscriptionId,
        addons.map((item) => ({ id: item.id, quantity: item.quantity }))
      )
      navigate('/my-subscriptions')
    } catch (err) {
      console.error(err)
      setSaving(false)
      setDialog({
        icon: 'alert',
        title: 'Could not save add-ons',
        body: err.message || 'Try again in a moment.',
        primaryLabel: 'OK',
      })
    }
  }

  const onSave = () => {
    if (saving) return
    setDialog({
      icon: 'mail',
      title: copy.title,
      body: `${copy.body} Add-ons are a one-time extra for that Sunday and will not repeat the following week.`,
      primaryLabel: 'Save add-ons',
      secondaryLabel: 'Cancel',
      onPrimary: saveAddons,
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
              <p className="subscribe-eyebrow">
                {plan.name || 'Your plan'} — {formatPlanPrice(plan.price_cents)}/week
              </p>
              <h1 className="subscribe-h1">Add extras this week</h1>
              <p className="subscribe-subhead">{copy.body}</p>
              <p className="subscribe-helper">
                <Link className="subscribe-inline-link" to="/my-subscriptions">Back to My Subscriptions</Link>
              </p>

              <SubscribeCatalog
                categories={categories}
                products={products}
                getTagNames={getTagNames}
                tagIcons={TAG_ICONS}
                quantityFor={(product) => lineQty(addons, product.id)}
                onIncrement={(product) => setAddons((prev) => bumpAddon({ addons: prev }, product, 1).addons)}
                onDecrement={(product) => setAddons((prev) => bumpAddon({ addons: prev }, product, -1).addons)}
                incrementDisabledFor={(product) => !product.is_available}
              />

              <div className="subscribe-flow-bar">
                <p className="subscribe-progress" aria-live="polite">
                  Add-on subtotal: ${(addonCents / 100).toFixed(2)}
                </p>
                <button
                  type="button"
                  className="subscribe-select-button"
                  disabled={saving}
                  onClick={onSave}
                >
                  {saving ? 'Saving…' : 'Save add-ons'}
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

export default SubscribeEditAddons
