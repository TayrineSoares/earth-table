import React from 'react';
// import "../styles/PrivacyPolicy.css";

const PrivacyPolicy = () => {
  return (
    <div className='page-wrapper'>
      <div className="privacy-policy-page">
        <h1 className="login-detail-header-text">Privacy Policy for Earth Table</h1>
        <p className="about-description"><strong>Effective Date:</strong> August 13, 2025</p>

        <p className="about-description">Earth Table values your privacy. This Privacy Policy explains what personal information we collect, how we use it, and your rights.</p>

        <h2 className="login-detail-header-text">Information We Collect</h2>
        <ul className="about-description">
          <li><strong>Personal details:</strong> Name, email address, and phone number when you sign up or place an order.</li>
          <li><strong>Payment information:</strong> All payments are processed securely via Stripe. We do not store credit card information on our servers.</li>
          <li><strong>Cookies & tracking:</strong> We use cookies and similar technologies to improve site functionality and track analytics.</li>
        </ul>

        <h2 className="login-detail-header-text">How We Use Your Information</h2>
        <ul className="about-description">
          <li>To process orders and deliver products or services.</li>
          <li>To communicate with you regarding your account, purchases, or promotions (with your consent).</li>
          <li>To improve our website and user experience via analytics.</li>
        </ul>

        <h2 className="login-detail-header-text">Sharing Your Information</h2>
        <ul className="about-description">
          <li>We do not sell your personal information.</li>
          <li>Stripe handles payment processing and may require some data to complete the transaction.</li>
          <li>Third-party analytics providers may receive anonymized or aggregated data.</li>
        </ul>

        <h2 className="login-detail-header-text">Your Rights</h2>
        <p className="about-description">
          Under Canadian privacy law (PIPEDA), you have the right to:
        </p>
        <ul className="about-description">
          <li>Access the personal information we hold about you.</li>
          <li>Request correction or deletion of your personal information.</li>
          <li>Withdraw consent for us to use your personal information at any time.</li>
          <li>Opt out of marketing communications (emails, newsletters) in accordance with CASL.</li>
        </ul>
        <p className="about-description">
          To exercise these rights, contact us at: <a href="mailto:privacy@earthtable.com">hello@earthtableco.ca</a>
        </p>

        <h2 className="login-detail-header-text">Data Security</h2>
        <ul className="about-description">
          <li>All sensitive information is transmitted over HTTPS.</li>
          <li>We use industry-standard security practices to protect your personal information.</li>
        </ul>

        <h2 className="login-detail-header-text">Changes to this Policy</h2>
        <p className="about-description">We may update this Privacy Policy periodically. Changes will be posted on this page with the effective date.</p>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
