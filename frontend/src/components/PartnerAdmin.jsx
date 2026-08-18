import { Fragment, useEffect, useMemo, useState } from 'react';
import { Pencil } from 'lucide-react';
import { fetchAllUsers } from '../helpers/adminHelpers';
import {
  createPartner,
  fetchPartnerDetail,
  fetchPartners,
  formatCents,
  formatPayoutLabel,
  setPartnerActive,
  setInvoicePaid,
  updatePartnerCode,
} from '../helpers/partnerHelpers';
import AdminTabLoading from './AdminTabLoading';
import PartnerMonthList from './PartnerMonthList';
import '../styles/PartnerAdmin.css';

const PartnerAdmin = () => {
  const [partners, setPartners] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userSearch, setUserSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [details, setDetails] = useState({});
  const [editingCodeId, setEditingCodeId] = useState(null);
  const [editCode, setEditCode] = useState('');
  const [savingCode, setSavingCode] = useState(false);

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

    setSaving(true);
    try {
      await createPartner({
        user_id: selectedUserId,
        referral_code: referralCode,
      });
      await load();
      setSelectedUserId('');
      setUserSearch('');
      setReferralCode('');
      setShowForm(false);
    } catch (err) {
      console.error('Error creating partner:', err);
      alert(err.message || 'Failed to create partner.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (row) => {
    try {
      const updated = await setPartnerActive(row.id, !row.active);
      setPartners((prev) =>
        prev.map((p) => (p.id === row.id ? { ...p, ...updated } : p))
      );
    } catch (err) {
      console.error('Error updating partner:', err);
      alert(err.message || 'Failed to update partner.');
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

      <button
        type="button"
        className="partner-toggle-button"
        onClick={() => setShowForm((prev) => !prev)}
      >
        {showForm ? 'Close' : 'Add partner'}
      </button>

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
            <button type="submit" className="partner-submit-button" disabled={saving}>
              {saving ? 'Adding…' : 'Save'}
            </button>
          </div>
        </form>
      )}

      {partners.length === 0 ? (
        <p className="partner-empty">No partners yet.</p>
      ) : (
        <div className="partner-table-wrap">
          <table className={expandedId ? 'partner-table has-expanded' : 'partner-table'}>
            <thead>
              <tr>
                <th></th>
                <th>PARTNER</th>
                <th>CODE</th>
                <th>PAYOUT</th>
                <th>THIS MONTH</th>
                <th>TOTAL EARNINGS</th>
                <th>ACTIVE</th>
              </tr>
            </thead>
            <tbody>
              {partners.map((row) => {
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
                        <div className="partner-name">{partnerName(row)}</div>
                        {row.user?.email && (
                          <div className="partner-email">{row.user.email}</div>
                        )}
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
                      <td>{formatPayoutLabel(row.payout_type)}</td>
                      <td>{formatCents(row.current_month_cents)}</td>
                      <td>{formatCents(row.total_earn_cents)}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={!!row.active}
                          onChange={() => handleToggleActive(row)}
                        />
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="partner-expand-row">
                        <td colSpan={7}>
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
