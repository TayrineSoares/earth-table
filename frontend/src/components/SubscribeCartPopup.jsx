import { useEffect, useState } from 'react'
import { Minus, ShoppingCart } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import '../styles/Products.css'
import '../styles/CartPopup.css'
import {
  addonSubtotalCents,
  lineQty,
  mealsExact,
  totalQty,
} from '../helpers/subscriptionCart'

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
      className={`cart-popup ${
        isMinimized ? (isMobile ? 'minimized-circle' : 'minimized') : ''
      }`}
    >
      {!isMinimized ? (
        <>
          <h3 className="cart-popup-header">
            <span className="popup-nav-text">Your box</span>
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
                      <span className="cart-popup-item-quantity">
                        QTY:
                        <div className="quantity-button-container">
                          <button
                            type="button"
                            onClick={() => bumpSubMeal(item, -1)}
                            className="cart-popup-add-remove-button"
                          >
                            -
                          </button>
                          {item.quantity}
                          <button
                            type="button"
                            onClick={() => bumpSubMeal(item, 1)}
                            className="cart-popup-add-remove-button"
                            disabled={mealCount >= subCart.mealCount}
                          >
                            +
                          </button>
                        </div>
                      </span>
                    </div>
                    <div className="cart-popup-item-details-2">
                      <span className="cart-popup-item-total-price">Meal</span>
                      <button
                        type="button"
                        className="cart-popup-remove-button"
                        onClick={() => bumpSubMeal(item, -lineQty(subCart.meals, item.id))}
                      >
                        REMOVE
                      </button>
                    </div>
                  </li>
                ))}
                {subCart.addons.map((item) => (
                  <li key={`addon-${item.id}`} className="cart-popup-item">
                    <img className="cart-popup-image" src={item.image_url} alt={item.slug} />
                    <div className="cart-popup-item-details-1">
                      <span className="cart-popup-item-name">{item.slug}</span>
                      <span className="cart-popup-item-quantity">
                        QTY:
                        <div className="quantity-button-container">
                          <button
                            type="button"
                            onClick={() => bumpSubAddon(item, -1)}
                            className="cart-popup-add-remove-button"
                          >
                            -
                          </button>
                          {item.quantity}
                          <button
                            type="button"
                            onClick={() => bumpSubAddon(item, 1)}
                            className="cart-popup-add-remove-button"
                          >
                            +
                          </button>
                        </div>
                      </span>
                    </div>
                    <div className="cart-popup-item-details-2">
                      <span className="cart-popup-item-total-price">
                        ${((item.price_cents * item.quantity) / 100).toFixed(2)}
                      </span>
                      <button
                        type="button"
                        className="cart-popup-remove-button"
                        onClick={() => bumpSubAddon(item, -lineQty(subCart.addons, item.id))}
                      >
                        REMOVE
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="cart-popup-footer">
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
            <p className="cart-total-text">
              {mealCount} / {subCart.mealCount} meals
            </p>
            <p className="cart-total">${(addonCents / 100).toFixed(2)}</p>
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
              <span>Your box ({itemCount})</span>
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
