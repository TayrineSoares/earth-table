import { useEffect, useState } from 'react';
import { Pencil } from 'lucide-react';
import AdminTabLoading from './AdminTabLoading';
import AdminToolbar from './admin/AdminToolbar';
import AdminButton from './admin/AdminButton';
import Badge from './admin/Badge';
import FormCard from './admin/FormCard';
import FormField from './admin/FormField';
import FeedbackDialog from './FeedbackDialog';
import {
  fetchSubscriptionPlans,
  fetchSubscriptionPlan,
  createSubscriptionPlan,
  updateSubscriptionPlan,
  discontinueSubscriptionPlan,
  fetchSubscriptionSettings,
  updateSubscriptionSettings,
  runSubscriptionCharge,
  runSubscriptionLock,
  formatPlanPrice,
  dollarsToCents,
  centsToDollarInput,
  toDatetimeLocalValue,
} from '../helpers/subscriptionHelpers';
import '../styles/PromoAdmin.css';
import '../styles/SubscriptionAdmin.css';
import '../styles/AdminShared.css';
import '../styles/FeedbackDialog.css';

const DEFAULT_DESCRIPTION = 'Choose any combination of bowls, salads, and mains.';

// Flip to true (or set VITE_SHOW_SUB_TEST_TIMES=true) before more pre-launch testing.
const SHOW_TEST_WEEK_TIMES = import.meta.env.VITE_SHOW_SUB_TEST_TIMES === 'true';

const SubscriptionAdmin = () => {
  const [plans, setPlans] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);

  const [name, setName] = useState('');
  const [mealCount, setMealCount] = useState('');
  const [priceDollars, setPriceDollars] = useState('');
  const [description, setDescription] = useState('');

  const [priceDrafts, setPriceDrafts] = useState({});
  const [descDrafts, setDescDrafts] = useState({});
  const [editingPriceId, setEditingPriceId] = useState(null);
  const [editingDescId, setEditingDescId] = useState(null);
  const [savingId, setSavingId] = useState(null);

  const [testCharge, setTestCharge] = useState('');
  const [testLock, setTestLock] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [jobBusy, setJobBusy] = useState('');
  const [jobNote, setJobNote] = useState('');
  const [dialog, setDialog] = useState(null);

  const load = async () => {
    const [planRows, settingsRow] = await Promise.all([
      fetchSubscriptionPlans(),
      fetchSubscriptionSettings(),
    ]);
    setPlans(planRows);
    setSettings(settingsRow);
    setTestCharge(toDatetimeLocalValue(settingsRow?.test_charge_at));
    setTestLock(toDatetimeLocalValue(settingsRow?.test_lock_at));

    const prices = {};
    const descs = {};
    for (const plan of planRows) {
      prices[plan.id] = centsToDollarInput(plan.price_cents);
      descs[plan.id] = plan.description || '';
    }
    setPriceDrafts(prices);
    setDescDrafts(descs);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        await load();
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load subscriptions.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // load once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');

    const cents = dollarsToCents(priceDollars);
    if (!Number.isFinite(cents)) {
      setError('Price must be a number in dollars (e.g. 180 or 1.00).');
      return;
    }

    try {
      const created = await createSubscriptionPlan({
        name,
        meal_count: mealCount,
        price_cents: cents,
        description: description.trim() || null,
        is_active: true,
      });
      setPlans((prev) => [...prev, created].sort((a, b) => a.meal_count - b.meal_count));
      setPriceDrafts((prev) => ({ ...prev, [created.id]: centsToDollarInput(created.price_cents) }));
      setDescDrafts((prev) => ({ ...prev, [created.id]: created.description || '' }));
      setName('');
      setMealCount('');
      setPriceDollars('');
      setDescription('');
      setShowForm(false);
    } catch (err) {
      setError(err.message || 'Failed to create plan.');
    }
  };

  const startEditPrice = (plan) => {
    setEditingPriceId(plan.id);
    setEditingDescId(null);
    setPriceDrafts((prev) => ({ ...prev, [plan.id]: centsToDollarInput(plan.price_cents) }));
  };

  const cancelEditPrice = (plan) => {
    setPriceDrafts((prev) => ({ ...prev, [plan.id]: centsToDollarInput(plan.price_cents) }));
    setEditingPriceId(null);
  };

  const startEditDescription = (plan) => {
    setEditingDescId(plan.id);
    setEditingPriceId(null);
    setDescDrafts((prev) => ({ ...prev, [plan.id]: plan.description || '' }));
  };

  const cancelEditDescription = (plan) => {
    setDescDrafts((prev) => ({ ...prev, [plan.id]: plan.description || '' }));
    setEditingDescId(null);
  };

  const handleSavePrice = async (plan) => {
    const cents = dollarsToCents(priceDrafts[plan.id]);
    if (!Number.isFinite(cents)) {
      setError('Price must be a number in dollars.');
      setPriceDrafts((prev) => ({ ...prev, [plan.id]: centsToDollarInput(plan.price_cents) }));
      return;
    }
    if (cents === plan.price_cents) {
      setEditingPriceId(null);
      return;
    }

    const confirmed = window.confirm(
      `Change "${plan.name}" from ${formatPlanPrice(plan.price_cents)} to ${formatPlanPrice(cents)} per week?\n\n` +
      'Customers already on this plan will be emailed. The new price applies at their next uncharged Wednesday (not this week if they already paid).'
    );
    if (!confirmed) {
      cancelEditPrice(plan);
      return;
    }

    setSavingId(plan.id);
    setError('');
    try {
      const { plan: updated } = await updateSubscriptionPlan(plan.id, { price_cents: cents });
      setPlans((prev) => prev.map((p) => (p.id === plan.id ? updated : p)));
      setPriceDrafts((prev) => ({ ...prev, [plan.id]: centsToDollarInput(updated.price_cents) }));
      setEditingPriceId(null);
    } catch (err) {
      setError(err.message || 'Failed to update price.');
      cancelEditPrice(plan);
    } finally {
      setSavingId(null);
    }
  };

  const handleSaveDescription = async (plan) => {
    const next = (descDrafts[plan.id] || '').trim() || null;
    const current = (plan.description || '').trim() || null;
    if (next === current) {
      setEditingDescId(null);
      return;
    }

    setSavingId(plan.id);
    setError('');
    try {
      const { plan: updated } = await updateSubscriptionPlan(plan.id, { description: next });
      setPlans((prev) => prev.map((p) => (p.id === plan.id ? updated : p)));
      setDescDrafts((prev) => ({ ...prev, [plan.id]: updated.description || '' }));
      setEditingDescId(null);
    } catch (err) {
      setError(err.message || 'Failed to update description.');
      cancelEditDescription(plan);
    } finally {
      setSavingId(null);
    }
  };

  const handleDiscontinuePlan = async (plan) => {
    if (plan.discontinued_at) return;

    setSavingId(plan.id);
    setError('');
    try {
      const live = await fetchSubscriptionPlan(plan.id);
      const count = Number(live.subscriber_count) || 0;
      const body = count > 0
        ? [
            `This will cancel all ${count} active subscription${count === 1 ? '' : 's'} on "${live.name}" and cannot be undone.`,
            'Affected customers will be notified by email. Any applicable plan and delivery refund for the current cycle will be processed (add-ons are never refunded).',
          ]
        : [
            `Discontinue "${live.name}"? This cannot be undone.`,
            'There are no active or paused subscribers on this plan. It will be marked discontinued and hidden from new signups.',
          ];

      setDialog({
        icon: 'alert',
        title: 'Discontinue this plan?',
        body,
        primaryLabel: 'Discontinue plan',
        secondaryLabel: 'Cancel',
        destructive: true,
        onPrimary: () => persistDiscontinue(live),
      });
    } catch (err) {
      setError(err.message || 'Failed to load plan subscribers.');
    } finally {
      setSavingId(null);
    }
  };

  const persistDiscontinue = async (plan) => {
    setDialog((prev) => (prev ? {
      ...prev,
      busy: true,
      primaryLabel: 'Discontinuing…',
    } : prev));
    setSavingId(plan.id);
    setError('');
    try {
      const result = await discontinueSubscriptionPlan(plan.id);
      setPlans((prev) => prev.map((p) => (p.id === plan.id ? result.plan : p)));
      setDialog(null);
    } catch (err) {
      setError(err.message || 'Failed to discontinue plan.');
      setDialog(null);
    } finally {
      setSavingId(null);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    setError('');
    try {
      const updated = await updateSubscriptionSettings({
        test_charge_at: testCharge ? new Date(testCharge).toISOString() : null,
        test_lock_at: testLock ? new Date(testLock).toISOString() : null,
      });
      setSettings(updated);
      setTestCharge(toDatetimeLocalValue(updated.test_charge_at));
      setTestLock(toDatetimeLocalValue(updated.test_lock_at));
    } catch (err) {
      setError(err.message || 'Failed to save test times.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleClearTestTimes = async () => {
    const confirmed = window.confirm(
      'Clear test times? The app will use live Wednesday 9:00 AM (charge) and Thursday 5:00 PM (meal lock) America/Toronto.'
    );
    if (!confirmed) return;

    setSavingSettings(true);
    setError('');
    try {
      const updated = await updateSubscriptionSettings({
        test_charge_at: null,
        test_lock_at: null,
      });
      setSettings(updated);
      setTestCharge('');
      setTestLock('');
    } catch (err) {
      setError(err.message || 'Failed to clear test times.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleRunJob = async (kind) => {
    const charge = kind === 'charge';
    const confirmed = window.confirm(
      charge
        ? 'Run Wednesday charge now? Unpaid active plans for this Sunday will be charged plan + delivery at the 9:00 AM ET cadence. Already-paid first weeks are skipped.'
        : 'Run Thursday lock now? Unpaid add-ons are charged, this Sunday is locked, and kitchen orders are created on the Subscriptions tab.'
    );
    if (!confirmed) return;
    setJobBusy(kind);
    setJobNote('');
    setError('');
    try {
      const result = charge ? await runSubscriptionCharge() : await runSubscriptionLock();
      const parts = [
        result.skipped ? result.reason || 'skipped' : null,
        result.sunday ? `Sunday ${result.sunday}` : null,
        result.charged != null ? `${result.charged} charged` : null,
        result.already != null ? `${result.already} already paid` : null,
        result.locked != null ? `${result.locked} locked` : null,
        result.addonsCharged != null ? `${result.addonsCharged} add-on charges` : null,
        result.emailed != null ? `${result.emailed} emailed` : null,
        result.failed != null ? `${result.failed} failed` : null,
      ].filter(Boolean);
      setJobNote(parts.join(' · ') || 'Done.');
    } catch (err) {
      setError(err.message || 'Job failed.');
    } finally {
      setJobBusy('');
    }
  };

  if (loading) {
    return (
      <div className="promo-admin-container">
        <h1 className="promo-admin-title">Weekly Plans</h1>
        <AdminTabLoading message="Loading plans…" />
      </div>
    );
  }

  return (
    <div className="promo-admin-container">
      <h1 className="promo-admin-title">Weekly Plans</h1>
      <p className="admin-tab-lead">
        These are the weekly meal plans customers choose on Subscribe &amp; Save.
        You can change the price and description anytime; the plan name and meal count stay fixed once created.
      </p>

      {error ? <p className="sub-admin-error">{error}</p> : null}

      {SHOW_TEST_WEEK_TIMES ? (
        <>
      <h2 className="sub-admin-h2">Test week times</h2>
      <p className="sub-admin-hint">
        Set these to times you can sit through (today → Friday). While they are set, the site uses them
        instead of Wednesday 9:00 AM / Thursday 5:00 PM. Browser local time. Clear both before launch.
      </p>
      <form className="promo-admin-form" onSubmit={handleSaveSettings}>
        <div className="promo-form-grid">
          <label className="promo-field">
            <span>Test charge (stands in for Wednesday 9:00 AM)</span>
            <input
              type="datetime-local"
              className="promo-input"
              value={testCharge}
              onChange={(e) => setTestCharge(e.target.value)}
            />
          </label>
          <label className="promo-field">
            <span>Test meal lock (stands in for Thursday 5pm)</span>
            <input
              type="datetime-local"
              className="promo-input"
              value={testLock}
              onChange={(e) => setTestLock(e.target.value)}
            />
          </label>
          <AdminButton type="submit" variant="primary" size="md" disabled={savingSettings}>
            {savingSettings ? 'Saving…' : 'Save test times'}
          </AdminButton>
          <AdminButton
            type="button"
            variant="secondary"
            size="md"
            onClick={handleClearTestTimes}
            disabled={savingSettings || (!settings?.test_charge_at && !settings?.test_lock_at)}
          >
            Use live Wednesday 9am / Thursday 5pm
          </AdminButton>
        </div>
      </form>
      <p className="sub-admin-hint">
        Run charge / lock yourself while testing. Live cron is Wednesday 9:00 AM and Thursday 5:00 PM America/Toronto (13:00 / 22:00 UTC).
      </p>
      <div className="sub-admin-inline" style={{ marginBottom: '1rem' }}>
        <AdminButton
          type="button"
          variant="primary"
          size="md"
          disabled={!!jobBusy}
          onClick={() => handleRunJob('charge')}
        >
          {jobBusy === 'charge' ? 'Running…' : 'Run Wednesday charge'}
        </AdminButton>
        <AdminButton
          type="button"
          variant="primary"
          size="md"
          disabled={!!jobBusy}
          onClick={() => handleRunJob('lock')}
        >
          {jobBusy === 'lock' ? 'Running…' : 'Run Thursday lock'}
        </AdminButton>
      </div>
      {jobNote ? <p className="sub-admin-hint">{jobNote}</p> : null}
        </>
      ) : null}

      <AdminToolbar
        showSearch={false}
        actionLabel={showForm ? 'Close Form' : 'Add New Plan'}
        onAction={() => {
          if (showForm) {
            setShowForm(false);
            setName('');
            setMealCount('');
            setPriceDollars('');
            setDescription('');
            return;
          }
          setShowForm(true);
        }}
        resultLabel={`${plans.length} ${plans.length === 1 ? 'plan' : 'plans'}`}
      />

      {showForm ? (
        <FormCard
          title="Add New Plan"
          onSubmit={handleCreate}
          onCancel={() => {
            setShowForm(false);
            setName('');
            setMealCount('');
            setPriceDollars('');
            setDescription('');
          }}
          submitLabel="Create plan"
        >
          <FormField label="Name" htmlFor="plan-name">
            <input
              id="plan-name"
              className="admin-control"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="10 meals"
              required
            />
          </FormField>
          <FormField label="Meal count" htmlFor="plan-meals">
            <input
              id="plan-meals"
              className="admin-control"
              type="number"
              min="1"
              step="1"
              value={mealCount}
              onChange={(e) => setMealCount(e.target.value)}
              required
            />
          </FormField>
          <FormField label="Price" hint="Dollars per week, pre-tax" htmlFor="plan-price">
            <div className="admin-prefix-field">
              <span className="admin-prefix" aria-hidden="true">$</span>
              <input
                id="plan-price"
                className="admin-control admin-prefix-input"
                type="number"
                min="0"
                step="0.01"
                value={priceDollars}
                onChange={(e) => setPriceDollars(e.target.value)}
                placeholder="180"
                required
              />
            </div>
          </FormField>
          <FormField label="Description" hint="Shown on the Subscribe & Save card" htmlFor="plan-description">
            <input
              id="plan-description"
              className="admin-control"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={DEFAULT_DESCRIPTION}
            />
          </FormField>
        </FormCard>
      ) : null}

      <h2 className="sub-admin-h2">Existing plans</h2>
      {plans.length === 0 ? (
        <p className="promo-empty">No plans yet. Run backend/sql/subscriptions.sql in the Supabase SQL editor.</p>
      ) : (
        <div className="sub-admin-table-wrap">
          <table className="promo-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Meals</th>
                <th>Price / week</th>
                <th>Description</th>
                <th>Subscribers</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => {
                const subscriberCount = Number(plan.subscriber_count) || 0;
                const discontinued = Boolean(plan.discontinued_at);
                return (
                <tr key={plan.id}>
                  <td>
                    <span className="promo-code-with-badge">
                      {plan.name}
                      {discontinued ? (
                        <Badge tone="muted">discontinued</Badge>
                      ) : !plan.is_active ? (
                        <Badge tone="muted">hidden</Badge>
                      ) : null}
                    </span>
                  </td>
                  <td>{plan.meal_count}</td>
                  <td>
                    {editingPriceId === plan.id ? (
                      <div className="sub-admin-inline">
                        <span>$</span>
                        <input
                          type="number"
                          className="promo-input sub-admin-price-input"
                          min="0"
                          step="0.01"
                          value={priceDrafts[plan.id] ?? ''}
                          onChange={(e) =>
                            setPriceDrafts((prev) => ({ ...prev, [plan.id]: e.target.value }))
                          }
                          autoFocus
                          disabled={savingId === plan.id}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSavePrice(plan);
                            }
                            if (e.key === 'Escape') cancelEditPrice(plan);
                          }}
                        />
                        <button
                          type="button"
                          className="sub-admin-text-btn"
                          disabled={savingId === plan.id}
                          onClick={() => handleSavePrice(plan)}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="sub-admin-text-btn sub-admin-text-btn-cancel"
                          disabled={savingId === plan.id}
                          onClick={() => cancelEditPrice(plan)}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="sub-admin-inline">
                        <span>{formatPlanPrice(plan.price_cents)}</span>
                        <button
                          type="button"
                          className="sub-admin-pencil"
                          aria-label={`Edit price for ${plan.name}`}
                          title="Edit price"
                          onClick={() => startEditPrice(plan)}
                        >
                          <Pencil size={14} />
                        </button>
                      </div>
                    )}
                  </td>
                  <td>
                    {editingDescId === plan.id ? (
                      <div className="sub-admin-inline sub-admin-desc-edit">
                        <input
                          type="text"
                          className="promo-input"
                          value={descDrafts[plan.id] ?? ''}
                          onChange={(e) =>
                            setDescDrafts((prev) => ({ ...prev, [plan.id]: e.target.value }))
                          }
                          placeholder={DEFAULT_DESCRIPTION}
                          autoFocus
                          disabled={savingId === plan.id}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSaveDescription(plan);
                            }
                            if (e.key === 'Escape') cancelEditDescription(plan);
                          }}
                        />
                        <button
                          type="button"
                          className="sub-admin-text-btn"
                          disabled={savingId === plan.id}
                          onClick={() => handleSaveDescription(plan)}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="sub-admin-text-btn sub-admin-text-btn-cancel"
                          disabled={savingId === plan.id}
                          onClick={() => cancelEditDescription(plan)}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="sub-admin-inline">
                        <span className={plan.description ? '' : 'sub-admin-muted'}>
                          {plan.display_description || DEFAULT_DESCRIPTION}
                        </span>
                        <button
                          type="button"
                          className="sub-admin-pencil"
                          aria-label={`Edit description for ${plan.name}`}
                          title="Edit description"
                          onClick={() => startEditDescription(plan)}
                        >
                          <Pencil size={14} />
                        </button>
                      </div>
                    )}
                  </td>
                  <td>
                    {subscriberCount} {subscriberCount === 1 ? 'person' : 'people'}
                  </td>
                  <td>
                    {discontinued ? (
                      <span className="sub-admin-muted">—</span>
                    ) : (
                      <AdminButton
                        type="button"
                        variant="danger"
                        size="sm"
                        disabled={savingId === plan.id}
                        onClick={() => handleDiscontinuePlan(plan)}
                      >
                        Discontinue
                      </AdminButton>
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <FeedbackDialog
        dialog={dialog}
        onClose={() => {
          if (!dialog?.busy) setDialog(null);
        }}
      />
    </div>
  );
};

export default SubscriptionAdmin;
