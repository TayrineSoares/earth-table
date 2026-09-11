import '../styles/SubscribeAndSave.css'
import subscriptionMeals from '../assets/images/subscription meals.png'

const SubscribeAndSave = () => {
  return (
    <div className="subscribe-page">
      <div className="page-wrapper">
        <div className="subscribe-content">
          <h1 className="subscribe-title">Subscribe & Save</h1>
          <p className="subscribe-subhead">A new way to order every week, coming soon.</p>
          <p className="subscribe-body">
            Pick your meals and save on your weekly order. We're building a subscription option so you never have to think about what's next.
          </p>

          <div className="subscribe-meals-row">
            <p className="subscribe-meal-option">10 meals a week</p>
            <p className="subscribe-meal-option">15 meals a week</p>
            <p className="subscribe-meal-option">20 meals a week</p>
          </div>
          <p className="subscribe-caption">Delivered every Sunday.</p>

          <img
            src={subscriptionMeals}
            alt="A spread of meal bowls"
            className="subscribe-photo"
          />
        </div>
      </div>
    </div>
  )
}

export default SubscribeAndSave
