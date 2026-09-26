import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { formatPlacedShort } from '../helpers/orderAdminHelpers';
import AdminTabLoading from './AdminTabLoading';
import AdminToolbar from './admin/AdminToolbar';
import AdminButton from './admin/AdminButton';
import Badge from './admin/Badge';
import FormCard from './admin/FormCard';
import FormField from './admin/FormField';
import '../styles/PromoAdmin.css';
import '../styles/AdminShared.css';

const normalizeCode = (value) => (value || '').trim();

function formatExpiresDisplay(iso) {
  if (!iso) return '—';
  return formatPlacedShort(iso) || '—';
}

const formatUses = (used, max) => {
  const usedLabel = Number.isFinite(Number(used)) ? String(used) : '0';
  const maxLabel = max == null ? '—' : String(max);
  return `${usedLabel} / ${maxLabel}`;
};

const PromoAdmin = () => {
  const [promos, setPromos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [code, setCode] = useState('');
  const [discountPercentage, setDiscountPercentage] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [firstTimeOnly, setFirstTimeOnly] = useState(false);
  const [maxUses, setMaxUses] = useState('');
  const [savingActiveId, setSavingActiveId] = useState(null);

  const loadPromos = async () => {
    const { data, error } = await supabase
      .from('promo_codes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching promo codes:', error);
      return [];
    }
    return data || [];
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const data = await loadPromos();
        if (!cancelled) setPromos(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const filteredPromos = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return promos;
    return promos.filter((p) => p.code?.toLowerCase().includes(term));
  }, [promos, searchTerm]);

  const resetForm = () => {
    setCode('');
    setDiscountPercentage('');
    setExpiresAt('');
    setFirstTimeOnly(false);
    setMaxUses('');
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const cleaned = normalizeCode(code);
    if (!cleaned) {
      alert('Code is required.');
      return;
    }

    const pct = parseInt(String(discountPercentage), 10);
    if (Number.isNaN(pct) || pct < 0 || pct > 100) {
      alert('Discount percentage must be a number from 0 to 100.');
      return;
    }

    let maxUsesVal = null;
    if (maxUses !== '') {
      maxUsesVal = parseInt(String(maxUses), 10);
      if (Number.isNaN(maxUsesVal) || maxUsesVal < 0) {
        alert('Max uses must be a non-negative integer or left empty.');
        return;
      }
    }

    const payload = {
      code: cleaned,
      discount_percentage: pct,
      active: true,
      first_time_only: firstTimeOnly,
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      max_uses: maxUsesVal,
    };

    const { data, error } = await supabase
      .from('promo_codes')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error('Error creating promo code:', error);
      alert(error.message || 'Failed to create promo code.');
      return;
    }

    setPromos((prev) => [data, ...prev]);
    resetForm();
    setShowForm(false);
  };

  const handleToggleActive = async (row) => {
    const next = !row.active;
    const confirmed = window.confirm(
      next
        ? `Activate ${row.code}? It will work at checkout again.`
        : `Deactivate ${row.code}? It will stop working at checkout.`
    );
    if (!confirmed) return;

    setSavingActiveId(row.id);
    try {
      const { error } = await supabase
        .from('promo_codes')
        .update({ active: next })
        .eq('id', row.id);

      if (error) {
        console.error('Error updating promo code:', error);
        alert(error.message || 'Failed to update promo code.');
        return;
      }

      setPromos((prev) =>
        prev.map((p) => (p.id === row.id ? { ...p, active: next } : p))
      );
    } finally {
      setSavingActiveId(null);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this promo code?')) return;

    const { error } = await supabase.from('promo_codes').delete().eq('id', id);

    if (error) {
      console.error('Error deleting promo code:', error);
      return;
    }

    setPromos((prev) => prev.filter((p) => p.id !== id));
  };

  if (loading) {
    return (
      <div className="promo-admin-container">
        <h1 className="promo-admin-title">Promo Codes Management</h1>
        <AdminTabLoading message="Loading promo codes…" />
      </div>
    );
  }

  return (
    <div className="promo-admin-container">
      <h1 className="promo-admin-title">Promo Codes Management</h1>
      <p className="admin-tab-lead">
        Create discount codes customers can enter at checkout.
        Turn a code off if you want to pause it, or delete it when you’re done with it.
      </p>

      <AdminToolbar
        searchValue={searchTerm}
        searchPlaceholder="Search by code"
        searchLabel="Search by code"
        onSearchChange={(e) => setSearchTerm(e.target.value)}
        actionLabel={showForm ? 'Close Form' : 'Add New Promo'}
        onAction={() => {
          if (showForm) {
            setShowForm(false);
            resetForm();
            return;
          }
          setShowForm(true);
        }}
        resultLabel={`${filteredPromos.length} ${filteredPromos.length === 1 ? 'promo' : 'promos'}`}
      />

      {showForm ? (
        <FormCard
          title="Add New Promo"
          onSubmit={handleCreate}
          onCancel={() => {
            setShowForm(false);
            resetForm();
          }}
          submitLabel="Create promo"
        >
          <FormField label="Code" htmlFor="promo-code">
            <input
              id="promo-code"
              className="admin-control"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. SUMMER20"
            />
          </FormField>
          <FormField label="Discount %" htmlFor="promo-discount">
            <input
              id="promo-discount"
              className="admin-control"
              type="number"
              min={0}
              max={100}
              step={1}
              value={discountPercentage}
              onChange={(e) => setDiscountPercentage(e.target.value)}
              placeholder="0–100"
            />
          </FormField>
          <FormField label="Expires" hint="Optional" htmlFor="promo-expires">
            <input
              id="promo-expires"
              className="admin-control"
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </FormField>
          <FormField label="Max uses" hint="Leave empty for unlimited" htmlFor="promo-max-uses">
            <input
              id="promo-max-uses"
              className="admin-control"
              type="number"
              min={0}
              step={1}
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
              placeholder="Unlimited if empty"
            />
          </FormField>
          <label className="admin-check-row">
            <input
              type="checkbox"
              checked={firstTimeOnly}
              onChange={(e) => setFirstTimeOnly(e.target.checked)}
            />
            First-time customers only
          </label>
        </FormCard>
      ) : null}

      {promos.length === 0 ? (
        <p className="promo-empty">No promo codes yet.</p>
      ) : filteredPromos.length === 0 ? (
        <p className="promo-empty">No codes match your search.</p>
      ) : (
        <table className="promo-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Discount</th>
              <th>Expires</th>
              <th>First-time only</th>
              <th>Uses</th>
              <th>Active</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filteredPromos.map((row) => {
              const isSaving = savingActiveId === row.id;
              return (
                <tr key={row.id}>
                  <td>
                    <span className="promo-code-cell">{row.code}</span>
                  </td>
                  <td className="admin-num">{row.discount_percentage}%</td>
                  <td>{formatExpiresDisplay(row.expires_at)}</td>
                  <td>
                    {row.first_time_only ? (
                      <Badge tone="accent">First order</Badge>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="promo-uses-cell">
                    {formatUses(row.used_count ?? 0, row.max_uses)}
                  </td>
                  <td>
                    <label
                      className={isSaving ? 'admin-toggle is-disabled' : 'admin-toggle'}
                    >
                      <input
                        type="checkbox"
                        checked={!!row.active}
                        disabled={isSaving}
                        onChange={() => handleToggleActive(row)}
                      />
                      <span className="admin-toggle-track" />
                      <span className="admin-toggle-label">
                        {row.active ? 'Active' : 'Inactive'}
                      </span>
                    </label>
                  </td>
                  <td>
                    <AdminButton
                      variant="danger"
                      size="sm"
                      onClick={() => handleDelete(row.id)}
                    >
                      Delete
                    </AdminButton>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default PromoAdmin;
