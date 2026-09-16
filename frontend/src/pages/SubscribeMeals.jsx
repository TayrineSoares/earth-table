import { Link } from 'react-router-dom'
import '../styles/SubscribeAndSave.css'
import '../styles/Contact.css'
import contactHeaderImage from '../assets/images/contactHeader.png'

/** Placeholder until Phase 3 (meal picker). Lets Select from marketing land somewhere. */
const SubscribeMeals = () => {

  return (
    <div className="subscribe-page">
      <div className="contact-header-image-container">
        <img src={contactHeaderImage} className="contact-header-image" alt="" />
      </div>
      <div className="page-wrapper">
        <div className="subscribe-content">
          <h1 className="subscribe-title">Choose your meals</h1>
          <p className="subscribe-body">
            Meal selection for this plan is next.
          </p>
          <Link className="subscribe-select-button" to="/subscribe-and-save">
            Back to plans
          </Link>
        </div>
      </div>
    </div>
  )
}

export default SubscribeMeals
