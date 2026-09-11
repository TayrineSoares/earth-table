import '../styles/SubscribeAndSave.css'
import '../styles/Contact.css'
import contactHeaderImage from '../assets/images/contactHeader.png'
import subscriptionMeals from '../assets/images/subscription meals.png'

const SubscribeAndSave = () => {
  return (
    <div className="subscribe-page">
      <div className="contact-header-image-container">
        <img src={contactHeaderImage} className="contact-header-image" alt="Background" />
      </div>

      <div className="page-wrapper">
        <div className="subscribe-content">
          <h1 className="subscribe-title">Subscribe & Save</h1>
          <p className="subscribe-subhead">Coming soon</p>
          <p className="subscribe-body">
            Pick your meals and save on your weekly order. We're building a subscription option so you never have to think about what's next.
          </p>

          <div className="subscribe-meals-row">
            <div className="subscribe-meal-option">
              <span className="subscribe-meal-count">10</span>
              <span className="subscribe-meal-label">meals</span>
            </div>
            <span className="subscribe-meal-divider" aria-hidden="true">•</span>
            <div className="subscribe-meal-option">
              <span className="subscribe-meal-count">15</span>
              <span className="subscribe-meal-label">meals</span>
            </div>
            <span className="subscribe-meal-divider" aria-hidden="true">•</span>
            <div className="subscribe-meal-option">
              <span className="subscribe-meal-count">20</span>
              <span className="subscribe-meal-label">meals</span>
            </div>
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
