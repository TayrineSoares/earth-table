import { Fragment, useEffect, useMemo, useState } from 'react';
import { Pencil } from 'lucide-react';
import { fetchAllUsers } from '../helpers/adminHelpers';
import {
  createPartner,
  fetchPartnerDetail,
  fetchPartners,
  formatCents,
  formatPayoutLabel,
  formatPhoneNumber,
  setPartnerActive,
  setInvoicePaid,
  updatePartnerCode,
  updatePartnerRates,
} from '../helpers/partnerHelpers';
import AdminTabLoading from './AdminTabLoading';
import PartnerMonthList from './PartnerMonthList';
import '../styles/PartnerAdmin.css';

const parseRateInput = (raw) => {
  if (raw === null || raw === undefined || String(raw).trim() === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0 || n > 100) return null;
  return n;
};

const PartnerAdmin = () => {
  const [partners, setPartners] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userSearch, setUserSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [discountPercent, setDiscountPercent] = useState('');
  const [cashbackPercent, setCashbackPercent] = useState('');
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [details, setDetails] = useState({});
  const [editingCodeId, setEditingCodeId] = useState(null);
  const [editCode, setEditCode] = useState('');
  const [savingCode, setSavingCode] = useState(false);
  const [editingDiscountId, setEditingDiscountId] = useState(null);
  const [editDiscount, setEditDiscount] = useState('');
  const [savingDiscount, setSavingDiscount] = useState(false);
  const [editingCashbackId, setEditingCashbackId] = useState(null);
  const [editCashback, setEditCashback] = useState('');
  const [savingCashback, setSavingCashback] = useState(false);
  const [savingActiveId, setSavingActiveId] = useState(null);
  const [statusTab, setStatusTab] = useState('active');

  const load = async () => {
    const [partnerRows, userRows] = await Promise.all([
      fetchPartners(),
      fetchAllUsers(),
    ]);
    setPartners(partnerRows);
    setUsers(userRows);
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const [partnerRows, userRows] = await Promise.all([
          fetchPartners(),
          fetchAllUsers(),
        ]);
        if (!cancelled) {
          setPartners(partnerRows);
          setUsers(userRows);
        }
      } catch (err) {
        console.error('Error loading partners:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const partnerUserIds = useMemo(
    () => new Set(partners.map((p) => p.user_id)),
    [partners]
  );

  const activePartners = useMemo(
    () => partners.filter((p) => p.active),
    [partners]
  );
  const inactivePartners = useMemo(
    () => partners.filter((p) => !p.active),
    [partners]
  );
  const visiblePartners = statusTab === 'active' ? activePartners : inactivePartners;

  const candidateUsers = useMemo(() => {
    const term = userSearch.trim().toLowerCase();
    const termDigits = userSearch.replace(/\D/g, '');
    return users
      .filter((user) => !partnerUserIds.has(user.auth_user_id))
      .filter((user) => {
        if (!term) return false;
        return (
          user.email?.toLowerCase().includes(term) ||
          user.first_name?.toLowerCase().includes(term) ||
          user.last_name?.toLowerCase().includes(term) ||
          (termDigits && user.phone_number?.includes(termDigits))
        );
      })
      .slice(0, 8);
  }, [users, partnerUserIds, userSearch]);

  const selectedUser = users.find((u) => u.auth_user_id === selectedUserId) || null;

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!selectedUserId) {
      alert('Search and select a user first.');
      return;
    }
    if (!referralCode.trim()) {
      alert('Referral code is required.');
      return;
    }
    const discount = parseRateInput(discountPercent);
    const cashback = parseRateInput(cashbackPercent);
    if (discount == null || cashback == null) {
      alert('Customer discount and partner cashback are required (whole numbers 0–100).');
      return;
    }

    setSaving(true);
    try {
      await createPartner({
        user_id: selectedUserId,
        referral_code: referralCode,
        discount_percent: discount,
        cashback_percent: cashback,
      });
      await load();
      setSelectedUserId('');
      setUserSearch('');
      setReferralCode('');
      setDiscountPercent('');
      setCashbackPercent('');
      setShowForm(false);
    } catch (err) {
      console.error('Error creating partner:', err);
      alert(err.message || 'Failed to create partner.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (row) => {
    const nextActive = !row.active;
    const name = partnerName(row);
    const confirmed = window.confirm(
      nextActive
        ? `Activate ${name}? Their referral code will work at checkout again.`
        : `Deactivate ${name}? Their referral code will stop working at checkout.`
    );
    if (!confirmed) return;

    setSavingActiveId(row.id);
    try {
      const updated = await setPartnerActive(row.id, nextActive);
      setPartners((prev) =>
        prev.map((p) => (p.id === row.id ? { ...p, ...updated } : p))
      );
      if (expandedId === row.id) setExpandedId(null);
    } catch (err) {
      console.error('Error updating partner:', err);
      alert(err.message || 'Failed to update partner.');
    } finally {
      setSavingActiveId(null);
    }
  };

  const handleStartEditCode = (row) => {
    setEditingCodeId(row.id);
    setEditCode(row.referral_code || '');
  };

  const handleCancelEditCode = () => {
    setEditingCodeId(null);
    setEditCode('');
  };

  const handleSaveCode = async (row) => {
    const nextCode = editCode.trim();
    if (!nextCode) {
      alert('Referral code is required.');
      return;
    }
    setSavingCode(true);
    try {
      const updated = await updatePartnerCode(row.id, nextCode);
      setPartners((prev) =>
        prev.map((p) => (p.id === row.id ? { ...p, ...updated } : p))
      );
      setEditingCodeId(null);
      setEditCode('');
    } catch (err) {
      console.error('Error updating referral code:', err);
      alert(err.message || 'Failed to update referral code.');
    } finally {
      setSavingCode(false);
    }
  };

  const handleStartEditDiscount = (row) => {
    setEditingCashbackId(null);
    setEditCashback('');
    setEditingDiscountId(row.id);
    setEditDiscount(String(row.discount_percent ?? ''));
  };

  const handleCancelEditDiscount = () => {
    setEditingDiscountId(null);
    setEditDiscount('');
  };

  const handleSaveDiscount = async (row) => {
    const discount = parseRateInput(editDiscount);
    if (discount == null) {
      alert('Customer discount must be a whole number from 0 to 100.');
      return;
    }
    setSavingDiscount(true);
    try {
      const updated = await updatePartnerRates(row.id, {
        discount_percent: discount,
      });
      setPartners((prev) =>
        prev.map((p) => (p.id === row.id ? { ...p, ...updated } : p))
      );
      setEditingDiscountId(null);
      setEditDiscount('');
    } catch (err) {
      console.error('Error updating customer discount:', err);
      alert(err.message || 'Failed to update customer discount.');
    } finally {
      setSavingDiscount(false);
    }
  };

  const handleStartEditCashback = (row) => {
    setEditingDiscountId(null);
    setEditDiscount('');
    setEditingCashbackId(row.id);
    setEditCashback(String(row.cashback_percent ?? ''));
  };

  const handleCancelEditCashback = () => {
    setEditingCashbackId(null);
    setEditCashback('');
  };

  const handleSaveCashback = async (row) => {
    const cashback = parseRateInput(editCashback);
    if (cashback == null) {
      alert('Partner cashback must be a whole number from 0 to 100.');
      return;
    }
    setSavingCashback(true);
    try {
      const updated = await updatePartnerRates(row.id, {
        cashback_percent: cashback,
      });
      setPartners((prev) =>
        prev.map((p) => (p.id === row.id ? { ...p, ...updated } : p))
      );
      setEditingCashbackId(null);
      setEditCashback('');
    } catch (err) {
      console.error('Error updating partner cashback:', err);
      alert(err.message || 'Failed to update partner cashback.');
    } finally {
      setSavingCashback(false);
    }
  };

  const handleToggleRow = async (partnerId) => {
    const nextId = expandedId === partnerId ? null : partnerId;
    setExpandedId(nextId);
    if (!nextId || details[partnerId]?.data || details[partnerId]?.loading) return;

    setDetails((prev) => ({ ...prev, [partnerId]: { loading: true } }));
    try {
      const data = await fetchPartnerDetail(partnerId);
      setDetails((prev) => ({ ...prev, [partnerId]: { loading: false, data } }));
    } catch (err) {
      console.error('Error loading partner detail:', err);
      setDetails((prev) => ({
        ...prev,
        [partnerId]: { loading: false, error: err.message || 'Failed to load months.' },
      }));
    }
  };

  const handleMarkPaid = async (partnerId, invoiceId, paid) => {
    const updated = await setInvoicePaid(invoiceId, paid);
    setDetails((prev) => {
      const current = prev[partnerId];
      if (!current?.data?.months) return prev;
      return {
        ...prev,
        [partnerId]: {
          ...current,
          data: {
            ...current.data,
            months: current.data.months.map((month) => (
              month.invoice?.id === invoiceId
                ? { ...month, invoice: { ...month.invoice, ...updated } }
                : month
            )),
          },
        },
      };
    });
  };

  const partnerName = (partner) => {
    const user = partner.user || {};
    const name = [user.first_name, user.last_name].filter(Boolean).join(' ');
    return name || user.email || partner.user_id;
  };

  if (loading) {
    return (
      <div className="partner-admin-container">
        <h1 className="partner-admin-title">Partners Management</h1>
        <AdminTabLoading message="Loading partners…" />
      </div>
    );
  }

  return (
    <div className="partner-admin-container">
      <h1 className="partner-admin-title">Partners Management</h1>
      <br />

      <div className="partner-form-toolbar">
        {showForm ? (
          <h2 className="partner-form-heading">Add new partner</h2>
        ) : (
          <span />
        )}
        <button
          type="button"
          className="partner-toggle-button"
          onClick={() => setShowForm((prev) => !prev)}
        >
          {showForm ? 'Close' : 'Add partner'}
        </button>
      </div>

      {showForm && (
        <form className="partner-admin-form" onSubmit={handleCreate}>
          <div className="partner-form-grid">
            <label className="partner-field">
              <span>User</span>
              <input
                type="text"
                className="partner-input"
                value={selectedUser
                  ? `${[selectedUser.first_name, selectedUser.last_name].filter(Boolean).join(' ')} (${selectedUser.email})`
                  : userSearch}
                onChange={(e) => {
                  setSelectedUserId('');
                  setUserSearch(e.target.value);
                }}
                placeholder="Search by name or email"
              />
              {!selectedUserId && candidateUsers.length > 0 && (
                <ul className="partner-user-results">
                  {candidateUsers.map((user) => (
                    <li key={user.auth_user_id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedUserId(user.auth_user_id);
                          setUserSearch('');
                        }}
                      >
                        {[user.first_name, user.last_name].filter(Boolean).join(' ') || '—'}
                        {' — '}
                        {user.email}
                        {user.phone_number ? ` — ${formatPhoneNumber(user.phone_number)}` : ''}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </label>
            <label className="partner-field">
              <span>Referral code</span>
              <input
                type="text"
                className="partner-input"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value)}
                placeholder="e.g. JOSH15"
              />
            </label>
            <label className="partner-field partner-field-rate">
              <span>Customer discount %</span>
              <input
                type="number"
                className="partner-input"
                min={0}
                max={100}
                step={1}
                value={discountPercent}
                onChange={(e) => setDiscountPercent(e.target.value)}
                placeholder="Required"
                required
              />
            </label>
            <label className="partner-field partner-field-rate">
              <span>Partner cashback %</span>
              <input
                type="number"
                className="partner-input"
                min={0}
                max={100}
                step={1}
                value={cashbackPercent}
                onChange={(e) => setCashbackPercent(e.target.value)}
                placeholder="Required"
                required
              />
            </label>
          </div>
          <div className="partner-form-actions">
            <button type="submit" className="partner-submit-button" disabled={saving}>
              {saving ? 'Adding…' : 'Save'}
            </button>
          </div>
        </form>
      )}

      <div className="partner-status-tabs" role="tablist" aria-label="Partner status">
        <button
          type="button"
          role="tab"
          aria-selected={statusTab === 'active'}
          className={statusTab === 'active' ? 'active' : ''}
          onClick={() => {
            setStatusTab('active');
            setExpandedId(null);
          }}
        >
          Active ({activePartners.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={statusTab === 'inactive'}
          className={statusTab === 'inactive' ? 'active' : ''}
          onClick={() => {
            setStatusTab('inactive');
            setExpandedId(null);
          }}
        >
          Inactive ({inactivePartners.length})
        </button>
      </div>

      {visiblePartners.length === 0 ? (
        <p className="partner-empty">
          {partners.length === 0
            ? 'No partners yet.'
            : statusTab === 'active'
              ? 'No active partners.'
              : 'No inactive partners.'}
        </p>
      ) : (
        <div className="partner-table-wrap">
          <table className={expandedId ? 'partner-table has-expanded' : 'partner-table'}>
            <thead>
              <tr>
                <th></th>
                <th>PARTNER</th>
                <th>CODE</th>
                <th className="partner-th-rate">CUSTOMER<br />DISCOUNT</th>
                <th className="partner-th-rate">PARTNER<br />CASHBACK</th>
                <th>PAYOUT</th>
                <th>THIS MONTH</th>
                <th>TOTAL EARNINGS</th>
                <th>ACTIVE</th>
              </tr>
            </thead>
            <tbody>
              {visiblePartners.map((row) => {
                const isExpanded = expandedId === row.id;
                const detail = details[row.id] || {};
                const months = detail.data?.months || [];
                return (
                  <Fragment key={row.id}>
                    <tr
                      className={isExpanded ? 'partner-row is-expanded' : 'partner-row'}
                      onClick={() => handleToggleRow(row.id)}
                    >
                      <td className="partner-expand-cell">{isExpanded ? '▾' : '▸'}</td>
                      <td>
                        <div className="partner-name-with-badge">
                          <div className="partner-name">{partnerName(row)}</div>
                          {!row.active && <span className="partner-inactive-badge">Inactive</span>}
                        </div>
                        {row.user?.email && (
                          <div className="partner-email">{row.user.email}</div>
                        )}
                        <div className="partner-email">
                          {formatPhoneNumber(row.user?.phone_number)}
                        </div>
                      </td>
                      <td
                        className="partner-code-cell"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {editingCodeId === row.id ? (
                          <div className="partner-code-edit">
                            <input
                              type="text"
                              className="partner-code-input"
                              value={editCode}
                              onChange={(e) => setEditCode(e.target.value.toUpperCase())}
                              autoFocus
                              disabled={savingCode}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleSaveCode(row);
                                }
                                if (e.key === 'Escape') handleCancelEditCode();
                              }}
                            />
                            <button
                              type="button"
                              className="partner-code-save"
                              onClick={() => handleSaveCode(row)}
                              disabled={savingCode}
                            >
                              {savingCode ? 'Saving…' : 'Save'}
                            </button>
                            <button
                              type="button"
                              className="partner-code-cancel"
                              onClick={handleCancelEditCode}
                              disabled={savingCode}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="partner-code-display">
                            <span>{row.referral_code}</span>
                            <button
                              type="button"
                              className="partner-code-edit-button"
                              onClick={() => handleStartEditCode(row)}
                              aria-label="Edit referral code"
                              title="Edit referral code"
                            >
                              <Pencil size={14} />
                            </button>
                          </div>
                        )}
                      </td>
                      <td
                        className="partner-rates-cell"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {editingDiscountId === row.id ? (
                          <div className="partner-rates-edit">
                            <label className="partner-rate-inline">
                              <input
                                type="number"
                                className="partner-rate-input"
                                min={0}
                                max={100}
                                step={1}
                                value={editDiscount}
                                onChange={(e) => setEditDiscount(e.target.value)}
                                autoFocus
                                disabled={savingDiscount}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleSaveDiscount(row);
                                  }
                                  if (e.key === 'Escape') handleCancelEditDiscount();
                                }}
                              />
                              <span>%</span>
                            </label>
                            <button
                              type="button"
                              className="partner-code-save"
                              onClick={() => handleSaveDiscount(row)}
                              disabled={savingDiscount}
                            >
                              {savingDiscount ? 'Saving…' : 'Save'}
                            </button>
                            <button
                              type="button"
                              className="partner-code-cancel"
                              onClick={handleCancelEditDiscount}
                              disabled={savingDiscount}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="partner-code-display">
                            <span>{row.discount_percent}%</span>
                            <button
                              type="button"
                              className="partner-code-edit-button"
                              onClick={() => handleStartEditDiscount(row)}
                              aria-label="Edit customer discount"
                              title="Edit customer discount"
                            >
                              <Pencil size={14} />
                            </button>
                          </div>
                        )}
                      </td>
                      <td
                        className="partner-rates-cell"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {editingCashbackId === row.id ? (
                          <div className="partner-rates-edit">
                            <label className="partner-rate-inline">
                              <input
                                type="number"
                                className="partner-rate-input"
                                min={0}
                                max={100}
                                step={1}
                                value={editCashback}
                                onChange={(e) => setEditCashback(e.target.value)}
                                autoFocus
                                disabled={savingCashback}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleSaveCashback(row);
                                  }
                                  if (e.key === 'Escape') handleCancelEditCashback();
                                }}
                              />
                              <span>%</span>
                            </label>
                            <button
                              type="button"
                              className="partner-code-save"
                              onClick={() => handleSaveCashback(row)}
                              disabled={savingCashback}
                            >
                              {savingCashback ? 'Saving…' : 'Save'}
                            </button>
                            <button
                              type="button"
                              className="partner-code-cancel"
                              onClick={handleCancelEditCashback}
                              disabled={savingCashback}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="partner-code-display">
                            <span>{row.cashback_percent}%</span>
                            <button
                              type="button"
                              className="partner-code-edit-button"
                              onClick={() => handleStartEditCashback(row)}
                              aria-label="Edit partner cashback"
                              title="Edit partner cashback"
                            >
                              <Pencil size={14} />
                            </button>
                          </div>
                        )}
                      </td>
                      <td>{formatPayoutLabel(row.payout_type)}</td>
                      <td>{formatCents(row.current_month_cents)}</td>
                      <td>{formatCents(row.total_earn_cents)}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <label
                          className={
                            savingActiveId === row.id
                              ? 'admin-toggle is-disabled'
                              : 'admin-toggle'
                          }
                        >
                          <input
                            type="checkbox"
                            checked={!!row.active}
                            disabled={savingActiveId === row.id}
                            onChange={() => handleToggleActive(row)}
                          />
                          <span className="admin-toggle-track" />
                          <span className="admin-toggle-label">
                            {row.active ? 'Active' : 'Inactive'}
                          </span>
                        </label>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="partner-expand-row">
                        <td colSpan={9}>
                          <p className="partner-wallet-balance">
                            Wallet balance (store credit): {formatCents(row.available_credit_cents)}
                          </p>
                          {detail.loading && <p className="partner-empty">Loading months…</p>}
                          {detail.error && <p className="partner-empty">{detail.error}</p>}
                          {!detail.loading && !detail.error && (
                            <PartnerMonthList
                              months={months}
                              isAdmin
                              onMarkPaid={(invoiceId, paid) =>
                                handleMarkPaid(row.id, invoiceId, paid)
                              }
                            />
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="partner-admin-note">
        Payout preference applies to new orders immediately. Monthly invoices show cash and store credit separately; cash can be marked paid only after the invoice is sent.
      </p>
    </div>
  );
};

export default PartnerAdmin;
