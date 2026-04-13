import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import '../styles/PromoAdmin.css';

const normalizeCode = (value) => (value || '').trim();

function formatExpiresDisplay(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return String(iso);
  }
}

const PromoAdmin = () => {
  const [promos, setPromos] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [code, setCode] = useState('');
  const [discountPercentage, setDiscountPercentage] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [firstTimeOnly, setFirstTimeOnly] = useState(false);
  const [maxUses, setMaxUses] = useState('');

  const loadPromos = async () => {
    const { data, error } = await supabase
      .from('promo_codes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching promo codes:', error);
      return;
    }
    setPromos(data || []);
  };

  useEffect(() => {
    loadPromos();
  }, []);

  const filteredPromos = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return promos;
    return promos.filter((p) => p.code?.toLowerCase().includes(term));
  }, [promos, searchTerm]);

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
    setCode('');
    setDiscountPercentage('');
    setExpiresAt('');
    setFirstTimeOnly(false);
    setMaxUses('');
  };

  const handleToggleActive = async (row) => {
    const next = !row.active;
    const { error } = await supabase
      .from('promo_codes')
      .update({ active: next })
      .eq('id', row.id);

    if (error) {
      console.error('Error updating promo code:', error);
      return;
    }

    setPromos((prev) =>
      prev.map((p) => (p.id === row.id ? { ...p, active: next } : p))
    );
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

  return (
    <div className="promo-admin-container">
      <h1 className="promo-admin-title">Promo Codes Management</h1>
      <br />

      <form className="promo-admin-form" onSubmit={handleCreate}>
        <div className="promo-form-grid">
          <label className="promo-field">
            <span>Code</span>
            <input
              type="text"
              className="promo-input"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. SUMMER20"
            />
          </label>
          <label className="promo-field">
            <span>Discount %</span>
            <input
              type="number"
              className="promo-input"
              min={0}
              max={100}
              step={1}
              value={discountPercentage}
              onChange={(e) => setDiscountPercentage(e.target.value)}
              placeholder="0–100"
            />
          </label>
          <label className="promo-field">
            <span>Expires (optional)</span>
            <input
              type="datetime-local"
              className="promo-input"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </label>
          <label className="promo-field promo-field-checkbox">
            <input
              type="checkbox"
              checked={firstTimeOnly}
              onChange={(e) => setFirstTimeOnly(e.target.checked)}
            />
            <span>First-time customers only</span>
          </label>
          <label className="promo-field">
            <span>Max uses (optional)</span>
            <input
              type="number"
              className="promo-input"
              min={0}
              step={1}
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
              placeholder="Unlimited if empty"
            />
          </label>
        </div>
        <button type="submit" className="promo-submit-button">
          Add promo code
        </button>
      </form>

      <br />

      <input
        type="text"
        className="promo-search-input"
        placeholder="Search by code"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />

      {promos.length === 0 ? (
        <p className="promo-empty">No promo codes yet.</p>
      ) : filteredPromos.length === 0 ? (
        <p className="promo-empty">No codes match your search.</p>
      ) : (
        <table className="promo-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Discount %</th>
              <th>Expires</th>
              <th>First-time only</th>
              <th>Max uses</th>
              <th>Used</th>
              <th>Active</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filteredPromos.map((row) => (
              <tr key={row.id}>
                <td>{row.code}</td>
                <td>{row.discount_percentage}</td>
                <td>{formatExpiresDisplay(row.expires_at)}</td>
                <td>{row.first_time_only ? 'Yes' : 'No'}</td>
                <td>{row.max_uses == null ? '—' : row.max_uses}</td>
                <td>{row.used_count ?? 0}</td>
                <td>
                  <input
                    type="checkbox"
                    checked={!!row.active}
                    onChange={() => handleToggleActive(row)}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="promo-delete-button"
                    onClick={() => handleDelete(row.id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default PromoAdmin;
