import { Link } from 'react-router-dom'
import '../styles/SubscribeSaveBand.css'

const STATS = [
  { value: 'From $18', label: 'per meal' },
  { value: '10–20', label: 'meals a week' },
  { value: 'Every Sunday', label: 'delivery or pickup' },
]

const SubscribeSaveBand = () => (
  <section className="subscribe-save-band" aria-labelledby="subscribe-save-band-heading">
    <div className="subscribe-save-band-inner">
      <div className="subscribe-save-band-copy">
        <p className="subscribe-save-band-eyebrow">Weekly plans</p>
        <h2 id="subscribe-save-band-heading" className="subscribe-save-band-title">
          Eat well all week & save up to 30%
        </h2>
        <p className="subscribe-save-band-body">
          Choose 10, 15, or 20 meals a week — organic, seed oil free, gluten free, cooked by Chef Selena. Delivered Sunday or ready for pickup.
        </p>
        <div className="subscribe-save-band-stats">
          {STATS.map((stat, index) => (
            <div
              key={stat.label}
              className={`subscribe-save-band-stat${index > 0 ? ' has-rule' : ''}`}
            >
              <p className="subscribe-save-band-stat-value">{stat.value}</p>
              <p className="subscribe-save-band-stat-label">{stat.label}</p>
            </div>
          ))}
        </div>
        <div className="subscribe-save-band-cta-row">
          <Link to="/subscribe-and-save" className="subscribe-save-band-cta">
            See all plans
          </Link>
        </div>
      </div>
    </div>
  </section>
)

export default SubscribeSaveBand
