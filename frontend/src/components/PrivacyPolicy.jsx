import "../styles/PrivacyPolicy.css";

const PrivacyPolicy = () => {
  return (
    <main className="et-terms">
      <section className="et-terms__card">
        <h1 className="et-terms__h1">Terms &amp; Conditions and Privacy Policy</h1>

        <p className="et-terms__p"><strong>Effective Date:</strong> August 13, 2025</p>
        <p className="et-terms__p">
          Earth Table values your privacy and transparency. Below you will find our Terms &amp; Conditions,
          followed by our Privacy Policy explaining what personal information we collect, how we use it,
          and your rights.
        </p>

        {/* Terms & Conditions */}
        <h2 className="et-terms__h2">Terms &amp; Conditions</h2>
        <ul className="et-terms__list">
          <li><strong>Pickup as default:</strong> All orders are <strong>pickup only</strong> until delivery has been explicitly confirmed by email.</li>
          <li><strong>No modifications or cancellations:</strong> Orders cannot be changed or cancelled once placed. Please review carefully before checkout.</li>
          <li><strong>Delivery requests:</strong> If you request delivery via Uber Courier, availability and cost must be confirmed by Earth Table through email before the order is considered scheduled for delivery.</li>
          <li><strong>Product availability:</strong> While we do our best to keep our menu accurate, all items are subject to availability. If a product is unavailable, we will notify you as soon as possible and suggest alternatives.</li>
          <li><strong>Allergies and notes:</strong> Customers are responsible for clearly indicating allergies or dietary restrictions in the “Special Instructions” field. Earth Table cannot guarantee against cross-contamination.</li>
          <li><strong>Agreement:</strong> By placing an order, you acknowledge and agree to these Terms &amp; Conditions.</li>
        </ul>

        {/* Privacy Policy */}
        <h2 className="et-terms__h2">Privacy Policy</h2>

        <h3 className="et-terms__h3">Information We Collect</h3>
        <ul className="et-terms__list">
          <li><strong>Personal details:</strong> Name, email address, and phone number when you sign up or place an order.</li>
          <li><strong>Payment information:</strong> All payments are processed securely via Stripe. We do not store credit card information on our servers.</li>
          <li><strong>Cookies &amp; tracking:</strong> We use cookies and similar technologies to improve site functionality and track analytics.</li>
        </ul>

        <h3 className="et-terms__h3">How We Use Your Information</h3>
        <ul className="et-terms__list">
          <li>To process orders and deliver products or services.</li>
          <li>To communicate with you regarding your account, purchases, or promotions (with your consent).</li>
          <li>To improve our website and user experience via analytics.</li>
        </ul>

        <h3 className="et-terms__h3">Sharing Your Information</h3>
        <ul className="et-terms__list">
          <li>We do not sell your personal information.</li>
          <li>Stripe handles payment processing and may require some data to complete the transaction.</li>
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
