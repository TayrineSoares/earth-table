import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Lottie from 'lottie-react'
import '../styles/SubscribeAndSave.css'
import subscriptionMeals from '../assets/images/subscription meals.png'
import loadingAnimation from '../assets/loading.json'
import FeedbackDialog from '../components/FeedbackDialog'
import {
  fetchSubscriptionPlans,
  fetchSubscriptionDates,
  formatPlanPrice,
} from '../helpers/subscriptionHelpers'

const HOW_IT_WORKS = [
  {
    number: '01',
    title: 'Pick your plan',
    body: '10, 15, or 20 meals a week. Mix bowls, salads, and main plates in any combination.',
  },
  {
    number: '02',
    title: 'Add items',
    body: 'Top off any week with snacks, smoothies, or anything else on the menu.',
  },
  {
    number: '03',
    title: 'Delivery or pickup',
    body: 'Your box arrives Sunday at your door, or waits for you at the shop, ready for the week.',
  },
  {
    number: '04',
    title: 'Change it up',
    body: 'Swap meals, add extras, skip a week, or pause before the 5:00 PM cutoff. No long-term commitment.',
  },
]

function formatPerMeal(priceCents, mealCount) {
  if (!mealCount) return null
  return formatPlanPrice(Math.round(Number(priceCents) / mealCount))
}

const SubscribeAndSave = () => {
  const [plans, setPlans] = useState([])
  const [dates, setDates] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [dialog, setDialog] = useState(null)

  useEffect(() => {
    let cancelled = false

    Promise.all([
      fetchSubscriptionPlans({ activeOnly: true }),
      fetchSubscriptionDates(),
    ])
      .then(([planRows, dateInfo]) => {
        if (cancelled) return
        setPlans(Array.isArray(planRows) ? planRows : [])
        setDates(dateInfo || null)
      })
      .catch((err) => {
        if (cancelled) return
        setDialog({
          icon: 'alert',
          title: 'Could not load plans',
          body: err.message || 'Please try again in a moment.',
          primaryLabel: 'Got it',
        })
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const savePercent = dates && dates.save_up_to_percent
  const cutoffPassed = !!(dates && dates.cutoff_passed)

  const onSelectPlan = (plan) => {
    const mealsPath = `/subscribe/${plan.id}/meals`
    if (!cutoffPassed) return

    setDialog({
      icon: 'alert',
      title: "This week's cutoff has passed",
      body: `If you subscribe now, your first delivery will be ${dates.first_delivery_label}. This Sunday is not available.`,
      primaryLabel: 'Continue',
      primaryTo: mealsPath,
      secondaryLabel: 'Go back',
    })
  }

  const sortedPlans = [...plans].sort((a, b) => {
    const aMain = a.meal_count >= 10 ? 0 : 1
    const bMain = b.meal_count >= 10 ? 0 : 1
    if (aMain !== bMain) return aMain - bMain
    return a.meal_count - b.meal_count
  })

  return (
    <div className="subscribe-page">
      <div className="page-wrapper">
        {isLoading ? (
          <div className="subscribe-loading">
            <Lottie animationData={loadingAnimation} loop={true} />
          </div>
        ) : (
          <div className="subscribe-content">
            <section className="subscribe-hero">
              <div className="subscribe-hero-copy">
                <p className="subscribe-eyebrow">Weekly subscription</p>
                <h1 className="subscribe-h1">
                  {savePercent
                    ? `Eat well all week. Save up to ${savePercent}%.`
                    : 'Eat well all week.'}
                </h1>
                <p className="subscribe-subhead">
                  Choose 10, 15, or 20 chef-made meals a week — bowls, salads, and main plates, mixed however you like. Delivered every Sunday, or ready for pickup.
                </p>
                <div className="subscribe-hero-cta-row">
                  <a className="subscribe-select-button" href="#subscribe-plans">
                    Choose your plan
                  </a>
                </div>
                <p className="subscribe-helper">
                  Savings based on à la carte pricing for the same meals.
                </p>
              </div>
              <div className="subscribe-hero-photo">
                <img src={subscriptionMeals} alt="A spread of weekly meals" />
              </div>
            </section>

            <section className="subscribe-how" aria-labelledby="subscribe-how-heading">
              <div className="subscribe-section-head">
                <h2 id="subscribe-how-heading">How it works</h2>
              </div>
              <div className="subscribe-how-steps">
                {HOW_IT_WORKS.map((step) => (
                  <article className="subscribe-how-step" key={step.number}>
                    <p className="subscribe-how-number">{step.number}</p>
                    <h3 className="subscribe-how-step-title">{step.title}</h3>
                    <p className="subscribe-how-step-body">{step.body}</p>
                  </article>
                ))}
              </div>
            </section>

            <p className="subscribe-cutoff-pill">
              Order by Thursday, 5:00 PM EST. Delivered the following Sunday.
            </p>

            <section
              className="subscribe-plans-section"
              id="subscribe-plans"
              aria-labelledby="subscribe-plans-heading"
            >
              <div className="subscribe-section-head">
                <h2 id="subscribe-plans-heading">Choose your plan</h2>
              </div>

              {sortedPlans.length === 0 ? (
                <p className="subscribe-empty">Plans will appear here soon.</p>
              ) : (
                <div className="subscribe-plan-cards">
                  {sortedPlans.map((plan) => {
                    const mealsPath = `/subscribe/${plan.id}/meals`
                    const popular = plan.meal_count === 15
                    const perMeal = formatPerMeal(plan.price_cents, plan.meal_count)
                    return (
                      <article
                        className={`subscribe-plan-card${popular ? ' is-popular' : ''}`}
                        key={plan.id}
                      >
                        {popular ? (
                          <p className="subscribe-popular-badge">Most popular</p>
                        ) : null}
                        <p className="subscribe-plan-count">
                          {plan.meal_count} {plan.meal_count === 1 ? 'meal' : 'meals'}/week
                        </p>
                        <p className="subscribe-plan-price">
                          {formatPlanPrice(plan.price_cents)}/week
                        </p>
                        {perMeal ? (
                          <p className="subscribe-plan-unit">{perMeal} per meal</p>
                        ) : null}
                        <p className="subscribe-plan-desc">{plan.display_description || plan.description}</p>
                        {cutoffPassed ? (
                          <button
                            type="button"
                            className="subscribe-select-button"
                            onClick={() => onSelectPlan(plan)}
                          >
                            Select
                          </button>
                        ) : (
                          <Link className="subscribe-select-button" to={mealsPath}>
                            Select
                          </Link>
                        )}
                      </article>
                    )
                  })}
                </div>
              )}

              <p className="subscribe-fine-print">
                Every plan lets you choose any combination of bowls, salads, and main plates. Make your picks by Thursday at 5:00 PM EST for that Sunday&apos;s box, miss it and we&apos;ll send your previous week&apos;s selections, or you can skip. Cancel by the same cutoff time, no fees.
                {dates && dates.first_delivery_label
                  ? ` Next delivery if you subscribe now: ${dates.first_delivery_label}.`
                  : ''}
              </p>
            </section>
          </div>
        )}
      </div>

      <FeedbackDialog dialog={dialog} onClose={() => setDialog(null)} />
    </div>
  )
}

export default SubscribeAndSave
