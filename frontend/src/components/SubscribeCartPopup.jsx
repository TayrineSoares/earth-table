import { useEffect, useState } from 'react'
import { Minus, ShoppingCart, Trash2 } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import '../styles/Products.css'
import '../styles/CartPopup.css'
import {
  addonSubtotalCents,
  lineQty,
  mealsExact,
  totalQty,
} from '../helpers/subscriptionCart'

/** Hide $0.00 in the popup; show a price only when add-ons add a charge. */
function moneyLabel(cents) {
  const n = Number(cents) || 0
  if (n === 0) return null
  return `$${(n / 100).toFixed(2)}`
}

function QtyAndTrash({ quantity, onMinus, onPlus, plusDisabled = false, onRemove, name }) {
  return (
    <span className="cart-popup-item-quantity">
      QTY:
      <div className="quantity-button-container">
        <button
          type="button"
          onClick={onMinus}
          className="cart-popup-add-remove-button"
          aria-label={`Decrease ${name}`}
        >
          -
        </button>
        {quantity}
        <button
          type="button"
          onClick={onPlus}
          className="cart-popup-add-remove-button"
          disabled={plusDisabled}
          aria-label={`Increase ${name}`}
        >
          +
        </button>
      </div>
      <button
        type="button"
        className="cart-popup-remove-button"
        onClick={onRemove}
        aria-label={`Remove ${name}`}
      >
        <Trash2 size={16} strokeWidth={2} />
      </button>
    </span>
  )
}

function SubscribeCartPopup({
  subCart,
  bumpSubMeal,
  bumpSubAddon,
}) {
  const [isMinimized, setIsMinimized] = useState(true)
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 480)
  const navigate = useNavigate()
  const location = useLocation()

  const mealCount = totalQty(subCart.meals)
  const addonCount = totalQty(subCart.addons)
  const itemCount = mealCount + addonCount
  const addonCents = addonSubtotalCents(subCart)
  const addonTotalLabel = moneyLabel(addonCents)
  const exact = mealsExact(subCart)
  const onAddons = location.pathname.includes('/addons')

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 480)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  if (itemCount === 0 && !isMinimized) {
    return null
  }

  const goNext = () => {
    if (onAddons) {
      navigate('/subscribe/cart')
      return
    }
    if (exact && subCart.planId) {
      navigate(`/subscribe/${subCart.planId}/addons`)
    }
  }

  return (
    <div
      className={`cart-popup subscribe-cart-popup ${
        isMinimized ? (isMobile ? 'minimized-circle' : 'minimized') : ''
      }`}
    >
      {!isMinimized ? (
        <>
          <h3 className="cart-popup-header">
            <span className="popup-nav-text">Your weekly plan</span>
            <button type="button" onClick={() => setIsMinimized(true)} aria-label="Minimize">
              <Minus />
            </button>
          </h3>

          {itemCount === 0 ? (
            <p>Cart is empty</p>
          ) : (
            <div className="cart-popup-container">
              <ul className="cart-popup-items">
                {subCart.meals.map((item) => (
                  <li key={`meal-${item.id}`} className="cart-popup-item">
                    <img className="cart-popup-image" src={item.image_url} alt={item.slug} />
                    <div className="cart-popup-item-details-1">
                      <span className="cart-popup-item-name">{item.slug}</span>
                      <QtyAndTrash
                        name={item.slug}
                        quantity={item.quantity}
                        onMinus={() => bumpSubMeal(item, -1)}
                        onPlus={() => bumpSubMeal(item, 1)}
                        plusDisabled={mealCount >= subCart.mealCount}
                        onRemove={() => bumpSubMeal(item, -lineQty(subCart.meals, item.id))}
                      />
                    </div>
                  </li>
                ))}
                {subCart.addons.map((item) => {
                  const addonLineLabel = moneyLabel(item.price_cents * item.quantity)
                  return (
                  <li key={`addon-${item.id}`} className="cart-popup-item">
                    <img className="cart-popup-image" src={item.image_url} alt={item.slug} />
                    <div className="cart-popup-item-details-1">
                      <span className="cart-popup-item-top">
                        <span className="cart-popup-item-name">{item.slug}</span>
                        {addonLineLabel ? (
                          <span className="cart-popup-item-total-price">{addonLineLabel}</span>
                        ) : null}
                      </span>
                      <QtyAndTrash
                        name={item.slug}
                        quantity={item.quantity}
                        onMinus={() => bumpSubAddon(item, -1)}
                        onPlus={() => bumpSubAddon(item, 1)}
                        onRemove={() => bumpSubAddon(item, -lineQty(subCart.addons, item.id))}
                      />
                    </div>
                  </li>
                  )
                })}
              </ul>
            </div>
          )}

          <div className="cart-popup-footer">
            <p className="cart-total-text">
              {mealCount} / {subCart.mealCount} meals
            </p>
            <div className="subscribe-cart-popup-footer-end">
              {addonTotalLabel ? (
                <p className="cart-total">Add-ons {addonTotalLabel}</p>
              ) : null}
              <div className="go-to-chekout-button-container">
                <button
                  type="button"
                  className="go-to-chekout-button"
                  onClick={goNext}
                  disabled={!onAddons && !exact}
                >
                  {onAddons ? 'Review order' : 'Continue'}
                </button>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div
          onClick={() => setIsMinimized(false)}
          className={isMobile ? 'minimized-circle' : 'minimized-bar'}
        >
          {isMobile ? (
            <div className="minimized-count">
              <ShoppingCart size={20} />
              <span>{' '}{itemCount}</span>
            </div>
          ) : (
            <>
              <span>Your weekly plan ({itemCount})</span>
              <button type="button" className="expand-button" aria-label="Expand cart">
                +
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default SubscribeCartPopup
