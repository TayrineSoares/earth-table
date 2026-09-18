import "../styles/PrivacyPolicy.css";

const PrivacyPolicy = () => {
  return (
    <main className="et-terms">
      <section className="et-terms__card">
        <h1 className="et-terms__h1">Terms &amp; Conditions and Privacy Policy</h1>

        <p className="et-terms__p"><strong>Effective Date:</strong> September 16, 2026</p>
        <p className="et-terms__p">
          Earth Table values your privacy and transparency. Below you will find our Terms &amp; Conditions,
          followed by our Privacy Policy explaining what personal information we collect, how we use it,
          and your rights.
        </p>

        {/* Terms & Conditions */}
        <h2 className="et-terms__h2">Terms &amp; Conditions</h2>
        <ul className="et-terms__list">
          <li><strong>Pickup as default:</strong> All orders are <strong>pickup only</strong> until delivery has been explicitly confirmed by email.</li>
          <li><strong>Delivery option:</strong> Customers may select delivery at checkout by entering a valid Canadian postal code and providing the full delivery address in the “Special Instructions” box.</li>
          <li><strong>Delivery zones &amp; fees:</strong> Within 10 km: <strong>$15</strong>; 11–30 km: <strong>$30</strong>. Delivery is not available beyond 30 km. For longer distances, email <a className="et-terms__link" href="mailto:hello@earthtableco.ca">hello@earthtableco.ca</a> to inquire about arranging an Uber Courier. Applicable taxes may apply to delivery fees.</li>
          <li><strong>Delivery confirmation:</strong> Delivery is considered confirmed only after Earth Table accepts your request (you'll receive an email confirmation). Until then, your order remains pickup.</li>
          <li><strong>No modifications or cancellations:</strong> Orders cannot be changed or cancelled once placed. Please review carefully before checkout.</li>
          <li><strong>Product availability:</strong> While we do our best to keep our menu accurate, all items are subject to availability. If a product is unavailable, we will notify you as soon as possible and suggest alternatives.</li>
          <li><strong>Allergies and notes:</strong> Customers are responsible for clearly indicating allergies or dietary restrictions in the “Special Instructions” field. Earth Table cannot guarantee against cross-contamination.</li>
          <li><strong>Agreement:</strong> By placing an order, you acknowledge and agree to these Terms &amp; Conditions.</li>
          <li><strong>Subscription plans:</strong> Customers may subscribe to a recurring weekly meal plan (10, 15, or 20 meals/week). Subscribers select their meals each cycle by the Thursday 5:00 PM ET cutoff. Add-ons do not carry over automatically to the following week. Cancelling or pausing a subscription for an upcoming Sunday must be done before Wednesday at 9:00 AM ET.</li>
          <li><strong>Auto-renewal:</strong> Subscription plans automatically renew and rebill each week. The plan and delivery are charged Wednesday at 9:00 AM ET; add-ons are charged at the Thursday 5:00 PM ET lock. You will be charged automatically for each upcoming cycle unless you cancel or pause before Wednesday at 9:00 AM ET.</li>
          <li><strong>Failed payments:</strong> If a recurring subscription charge fails, Stripe will automatically retry the payment according to its retry schedule. We will notify you by email so you can update your payment method on file. If the charge still cannot be completed after retry attempts, your subscription may be paused until a valid payment method is provided. Fulfillment of the affected cycle may be delayed or withheld until payment succeeds.</li>
          <li><strong>Price changes:</strong> Earth Table may change subscription pricing from time to time. If we do, we will give subscribers advance notice (for example, by email) before the new price applies to their next billing cycle. If you do not accept the new price, you may cancel or pause your subscription before the new price takes effect.</li>
          <li><strong>Subscription refunds:</strong> Subscription orders are non-refundable once a cycle's Wednesday 9:00 AM ET charge has passed. Customers who wish to avoid a charge for an upcoming week must cancel or pause before Wednesday at 9:00 AM ET for that cycle.</li>
        </ul>

        {/* Privacy Policy */}
        <h2 className="et-terms__h2">Privacy Policy</h2>

        <h3 className="et-terms__h3">Information We Collect</h3>
        <ul className="et-terms__list">
          <li><strong>Personal details:</strong> Name, email address, and phone number when you sign up or place an order.</li>
          <li><strong>Delivery details (when selected):</strong> Your <strong>postal code</strong> (to calculate distance and delivery fee) and the <strong>full delivery address</strong> you provide in the “Special Instructions” box so we can fulfill delivery.</li>
          <li><strong>Subscription details:</strong> If you subscribe to a recurring meal plan, we collect your selected plan tier, weekly meal selections, and subscription status (active, paused, cancelled).</li>
          <li><strong>Payment information:</strong> All payments, including recurring subscription charges, are processed securely via Stripe. We do not store credit card information on our servers; Stripe securely stores your payment method on file to process recurring charges.</li>
          <li><strong>Cookies &amp; tracking:</strong> We use cookies and similar technologies to improve site functionality and track analytics.</li>
        </ul>

        <h3 className="et-terms__h3">How We Use Your Information</h3>
        <ul className="et-terms__list">
          <li>To process orders and deliver products or services.</li>
          <li>For delivery requests: to estimate distance/fee based on your postal code and to dispatch to the address you provide.</li>
          <li>To communicate with you regarding your account, purchases, or promotions (with your consent).</li>
          <li>To improve our website and user experience via analytics.</li>
          <li>To process and bill recurring subscription orders on your selected schedule.</li>
          <li>To send weekly reminder and cutoff notification emails for subscription meal selections.</li>
          <li>To manage subscription changes, pauses, and cancellations you request.</li>
          <li>To manage failed or incomplete recurring charges using payment status from Stripe, including retrying payment, pausing a subscription when a charge cannot be completed, and emailing you to update your payment method.</li>
          <li>To apply our subscription refund policy, including using cutoff timing and payment status to determine whether a cycle charge is eligible for a refund.</li>
        </ul>

        <h3 className="et-terms__h3">Sharing Your Information</h3>
        <ul className="et-terms__list">
          <li>We do not sell your personal information.</li>
          <li>Stripe handles payment processing, including recurring subscription billing, and may require some data to complete transactions and store your payment method for recurring charges.</li>
          <li><strong>Geocoding for delivery:</strong> When you enter a postal code for delivery, we may send the postal code to a third-party geocoding provider (e.g., Geoapify) to estimate distance and calculate the delivery fee.</li>
          <li><strong>Delivery partners (when applicable):</strong> If delivery is confirmed, we may share your name, phone, and delivery address with a courier (e.g., Uber Courier) solely to fulfill your delivery.</li>
          <li>Third-party analytics providers may receive anonymized or aggregated data.</li>
        </ul>

        <h3 className="et-terms__h3">Your Rights</h3>
        <p className="et-terms__p">
          Under Canadian privacy law (PIPEDA), you have the right to:
        </p>
        <ul className="et-terms__list">
          <li>Access the personal information we hold about you.</li>
          <li>Request correction or deletion of your personal information.</li>
          <li>Withdraw consent for us to use your personal information at any time.</li>
          <li>Opt out of marketing communications (emails, newsletters) in accordance with CASL.</li>
          <li>Cancel or pause your subscription in My Subscriptions before Wednesday at 9:00 AM ET to skip that Sunday's charge.</li>
        </ul>
        <p className="et-terms__p">
          To exercise these rights, contact us at:{" "}
          <a className="et-terms__link" href="mailto:hello@earthtableco.ca">hello@earthtableco.ca</a>
        </p>

        <h3 className="et-terms__h3">Data Security</h3>
        <ul className="et-terms__list">
          <li>All sensitive information is transmitted over HTTPS.</li>
          <li>We use industry-standard security practices to protect your personal information.</li>
        </ul>

        <h3 className="et-terms__h3">Changes to this Policy</h3>
        <p className="et-terms__p">
          We may update this Privacy Policy periodically. Changes will be posted on this page with the effective date.
        </p>
      </section>
    </main>
  );
};

export default PrivacyPolicy;
