import "../styles/PrivacyPolicy.css";

const PrivacyPolicy = () => {
  return (
    <main className="et-terms">
      <section className="et-terms__card">
        <h1 className="et-terms__h1">Terms &amp; Conditions and Privacy Policy</h1>

        <p className="et-terms__p"><strong>Effective Date:</strong> September 19, 2026</p>
        <p className="et-terms__p">
          Earth Table values your privacy and transparency. Below you will find our Terms &amp; Conditions,
          followed by our Privacy Policy explaining what personal information we collect, how we use it,
          and your rights. Times are America/Toronto.
        </p>

        <h2 className="et-terms__h2">Terms &amp; Conditions</h2>

        <h3 className="et-terms__h3">À la carte orders</h3>
        <ul className="et-terms__list">
          <li><strong>Pickup or delivery:</strong> Choose pickup or delivery at checkout. Pickup is at 77 Woodstream Blvd, Vaughan, ON L4L 7Y7, in the time window you select. Delivery is Sunday, 11:00 AM – 6:00 PM.</li>
          <li><strong>Delivery details:</strong> Enter a valid Canadian postal code so we can quote the fee, and put your full delivery address (and any notes) in the single “Special Instructions” field.</li>
          <li><strong>Delivery zones &amp; fees:</strong> Within 10 km: <strong>$15</strong>; 11–30 km: <strong>$30</strong> (pre-tax). Delivery is not available beyond 30 km. For longer distances, email <a className="et-terms__link" href="mailto:hello@earthtableco.ca">hello@earthtableco.ca</a> about an Uber Courier. 13% HST applies to meals and delivery.</li>
          <li><strong>No changes after checkout:</strong> À la carte orders cannot be changed or cancelled once placed. Please review carefully before you pay.</li>
        </ul>

        <h3 className="et-terms__h3">Weekly subscriptions</h3>
        <ul className="et-terms__list">
          <li><strong>Plans:</strong> Recurring weekly meal plans (10, 15, or 20 meals). Advertised prices are pre-tax meals only. Checkout and weekly bills add 13% HST. Delivery, if you choose it, is extra at the same zone fees as à la carte, plus HST.</li>
          <li><strong>First week:</strong> Plan and delivery (if any) are charged when you subscribe. Add-ons on that first box are billed later, at Thursday lock, if they are still on the box.</li>
          <li><strong>Promo and referral codes:</strong> A valid code discounts your first week only — the plan charged at signup, and add-ons billed at that first Thursday lock. Delivery is not discounted. Later Wednesday charges are the regular plan price.</li>
          <li><strong>Weekly charge:</strong> After the first week, plan and delivery are charged every <strong>Wednesday at 9:00 AM ET</strong> to the card on file. We email a receipt at that same time.</li>
          <li><strong>Meal and add-on cutoff:</strong> Change meals, extras, pickup, or delivery until <strong>Thursday at 5:00 PM ET</strong>. Then extras still on the box are charged, the box is locked, and we email confirmation (with an extras receipt if anything was billed). Add-ons do not repeat the following week unless you add them again. If you do not pick meals before cutoff, we repeat last week’s selections.</li>
          <li><strong>Pause or cancel:</strong> Pause or cancel in My Subscriptions before <strong>Wednesday at 9:00 AM ET</strong> to skip that Sunday’s charge. No fees. Your meals and saved card stay on file until you resume. After Wednesday 9:00 AM ET, that Sunday still goes out; the pause or cancel starts the following week.</li>
          <li><strong>Failed payments:</strong> If Wednesday’s charge is declined, we pause the plan and email you. Update your card in My Subscriptions before Thursday at 5:00 PM ET to still receive that Sunday. If it is still unpaid at lock, that Sunday is skipped and the plan stays paused until you resume.</li>
          <li><strong>Holidays:</strong> We skip blocked Sundays (December 25, 26, 31, and January 1). That week is not charged and not delivered. We email you the next Sunday that will run.</li>
          <li><strong>Price changes:</strong> If we change a plan price, we email current subscribers. The new price applies at the next Wednesday 9:00 AM ET charge that is not already billed. Pause or cancel before that charge if you do not accept the new price.</li>
          <li><strong>Refunds:</strong> A weekly box is non-refundable after Wednesday 9:00 AM ET for that cycle (or after you are charged at signup for the first week). Avoid a charge by pausing or cancelling before Wednesday 9:00 AM ET.</li>
        </ul>

        <h3 className="et-terms__h3">General</h3>
        <ul className="et-terms__list">
          <li><strong>Product availability:</strong> Menu items are subject to availability. If something is unavailable, we will notify you and suggest alternatives when we can.</li>
          <li><strong>Allergies and notes:</strong> Tell us about allergies or dietary restrictions in Special Instructions. We cannot guarantee against cross-contamination.</li>
          <li><strong>Agreement:</strong> By creating an account, placing an order, or subscribing, you agree to these Terms &amp; Conditions.</li>
        </ul>

        <h2 className="et-terms__h2">Privacy Policy</h2>

        <h3 className="et-terms__h3">Information We Collect</h3>
        <ul className="et-terms__list">
          <li><strong>Account:</strong> Name, email, phone, and login credentials when you register (authentication is handled by our auth provider).</li>
          <li><strong>Order details:</strong> Items, quantities, pickup time slot or delivery postal code, and whatever you type in Special Instructions (one field for delivery address and notes).</li>
          <li><strong>Subscription details:</strong> Plan, weekly meal and add-on selections, pickup vs delivery, pause/cancel status, and which Sunday a box is for.</li>
          <li><strong>Payment:</strong> Payments run through Stripe. We do not store full card numbers. Stripe stores the payment method so we can charge the first week at signup, Wednesday 9:00 AM ET plan-and-delivery charges, and Thursday 5:00 PM ET add-on charges.</li>
          <li><strong>Cookies &amp; analytics:</strong> We use cookies and similar tools for site function and aggregated analytics.</li>
        </ul>

        <h3 className="et-terms__h3">How We Use Your Information</h3>
        <ul className="et-terms__list">
          <li>To create and manage your account, orders, and weekly boxes.</li>
          <li>To quote delivery from your postal code and to fulfill pickup or delivery.</li>
          <li>To charge the saved card on the schedule above and to send transactional mail that is part of the service: order/subscription confirmation, the Wednesday 9:00 AM ET plan-and-delivery receipt, Thursday lock (and extras receipt if billed), pause/resume, payment-failed, holiday skip, and plan-price notices.</li>
          <li>To apply pause, cancel, resume, plan changes, and the refund rules in these terms.</li>
          <li>To improve the site with analytics.</li>
          <li>To send marketing only with consent, in accordance with CASL. You can opt out of marketing without opting out of receipts and other transactional mail.</li>
        </ul>

        <h3 className="et-terms__h3">Sharing Your Information</h3>
        <ul className="et-terms__list">
          <li>We do not sell your personal information.</li>
          <li>Stripe processes payments and stores the payment method for recurring charges.</li>
          <li><strong>Geocoding:</strong> We may send the postal code you enter to a geocoding provider (for example Geoapify) to estimate distance and the delivery fee.</li>
          <li><strong>Couriers:</strong> If you chose delivery, we may share your name, phone, and delivery address with a courier (for example Uber Courier) only to complete that delivery.</li>
          <li>Analytics providers may receive anonymized or aggregated data.</li>
        </ul>

        <h3 className="et-terms__h3">Your Rights</h3>
        <p className="et-terms__p">
          Under Canadian privacy law (PIPEDA), you have the right to:
        </p>
        <ul className="et-terms__list">
          <li>Access the personal information we hold about you.</li>
          <li>Request correction or deletion of your personal information, subject to records we must keep for orders, taxes, or the law.</li>
          <li>Withdraw consent for uses that are not required to fulfill an order or subscription.</li>
          <li>Opt out of marketing communications under CASL.</li>
          <li>Pause or cancel a subscription in My Subscriptions before Wednesday at 9:00 AM ET to skip that Sunday’s charge.</li>
        </ul>
        <p className="et-terms__p">
          To exercise these rights, contact us at:{" "}
          <a className="et-terms__link" href="mailto:hello@earthtableco.ca">hello@earthtableco.ca</a>
        </p>

        <h3 className="et-terms__h3">Data Security &amp; Retention</h3>
        <ul className="et-terms__list">
          <li>Sensitive information is transmitted over HTTPS.</li>
          <li>We use industry-standard practices to protect personal information.</li>
          <li>We keep order and subscription records as needed to fulfill boxes, handle billing questions, and meet accounting and legal requirements.</li>
        </ul>

        <h3 className="et-terms__h3">Changes to this Policy</h3>
        <p className="et-terms__p">
          We may update these Terms and this Privacy Policy. Changes will be posted on this page with the effective date.
        </p>
      </section>
    </main>
  );
};

export default PrivacyPolicy;
