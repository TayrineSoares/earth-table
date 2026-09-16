import { Fragment, useEffect, useState } from 'react';
import AdminTabLoading from './AdminTabLoading';
import {
  fetchAdminSubscriptions,
  formatPickupSlot,
  formatPlanPrice,
  mealsAWeek,
} from '../helpers/subscriptionHelpers';
import '../styles/PromoAdmin.css';
import '../styles/UsersAdmin.css';
import '../styles/SubscriptionAdmin.css';

const formatPhone = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  const d = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  return String(phone || '').trim() || '—';
};

const formatYmd = (ymd) => {
  if (!ymd) return '—';
  const [y, m, d] = String(ymd).split('-').map(Number);
  if (!y || !m || !d) return '—';
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
};

const customerName = (customer) => {
  const name = [customer?.first_name, customer?.last_name].filter(Boolean).join(' ').trim();
  return name || customer?.email || 'Customer';
};

const SubscriberAdmin = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await fetchAdminSubscriptions();
        if (!cancelled) setRows(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load subscriptions.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = rows.filter((row) => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;
    const customer = row.customer || {};
    const plan = row.subscription_plans || {};
    const hay = [
      customer.first_name,
      customer.last_name,
      customer.email,
      customer.phone_number,
      plan.name,
      row.status,
      row.id,
    ].join(' ').toLowerCase();
    return hay.includes(term);
  });

  if (loading) {
    return (
      <div className="promo-admin-container">
        <h1 className="promo-admin-title">Subscriptions</h1>
        <AdminTabLoading message="Loading subscriptions…" />
      </div>
    );
  }

  return (
    <div className="promo-admin-container">
      <h1 className="promo-admin-title">Subscriptions</h1>
      <p className="sub-admin-lead">
        People currently on a weekly plan. Expand a row for this Sunday&apos;s meals and add-ons.
      </p>

      {error ? <p className="sub-admin-error">{error}</p> : null}

      <input
        className="user-search-input"
        type="text"
        placeholder="Search by name, email, phone, or plan"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />

      {filtered.length === 0 ? (
        <p className="promo-empty">No subscriptions match.</p>
      ) : (
        <div className="sub-admin-table-wrap">
          <table className="promo-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Plan</th>
                <th>Status</th>
                <th>This Sunday</th>
                <th>Fulfillment</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const customer = row.customer || {};
                const plan = row.subscription_plans || {};
                const cycle = row.cycle || {};
                const items = Array.isArray(cycle.subscription_cycle_items)
                  ? cycle.subscription_cycle_items
                  : [];
                const meals = items.filter((item) => item.kind === 'plan');
                const addons = items.filter((item) => item.kind === 'addon');
                const isOpen = expandedId === row.id;
                const sunday = formatYmd(cycle.delivery_date || cycle.pickup_date);
                const fulfillment = cycle.delivery
                  ? `Delivery${cycle.delivery_postal_code ? ` · ${cycle.delivery_postal_code}` : ''}`
                  : `Pickup${cycle.pickup_time_slot ? ` · ${formatPickupSlot(cycle.pickup_time_slot)}` : ''}`;

                return (
                  <Fragment key={row.id}>
                    <tr>
                      <td>
                        <div>{customerName(customer)}</div>
                        <div className="sub-admin-muted">{customer.email || '—'}</div>
                        <div className="sub-admin-muted">{formatPhone(customer.phone_number)}</div>
                      </td>
                      <td>
                        {mealsAWeek(plan.meal_count)}
                        <div className="sub-admin-muted">{formatPlanPrice(plan.price_cents)}/week</div>
                      </td>
                      <td>
                        {row.status}
                        {row.pending_status ? (
                          <div className="sub-admin-muted">pending {row.pending_status}</div>
                        ) : null}
                        {row.pending_plan ? (
                          <div className="sub-admin-muted">
                            next: {mealsAWeek(row.pending_plan.meal_count)}
                          </div>
                        ) : null}
                      </td>
                      <td>{sunday}</td>
                      <td>{fulfillment}</td>
                      <td>
                        <button
                          type="button"
                          className="promo-delete-button"
                          onClick={() => setExpandedId(isOpen ? null : row.id)}
                        >
                          {isOpen ? 'Hide' : 'View'}
                        </button>
                      </td>
                    </tr>
                    {isOpen ? (
                      <tr>
                        <td colSpan={6}>
                          <div className="sub-admin-details">
                            {cycle.special_note ? (
                              <p>
                                <strong>Notes:</strong>{' '}
                                <span style={{ whiteSpace: 'pre-wrap' }}>{cycle.special_note}</span>
                              </p>
                            ) : null}
                            <p><strong>Meals</strong></p>
                            {meals.length ? (
                              <ul>
                                {meals.map((item) => (
                                  <li key={item.id}>
                                    {item.quantity > 1 ? `${item.quantity}× ` : ''}
                                    {item.products?.slug || 'Meal'}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="sub-admin-muted">No meals picked yet.</p>
                            )}
                            <p><strong>Add-ons</strong></p>
                            {addons.length ? (
                              <ul>
                                {addons.map((item) => (
                                  <li key={item.id}>
                                    {item.quantity > 1 ? `${item.quantity}× ` : ''}
                                    {item.products?.slug || 'Add-on'}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="sub-admin-muted">None this week.</p>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default SubscriberAdmin;
