import { useState } from 'react';
import { Check } from 'lucide-react';
import {
  formatCents,
  formatOrderDate,
  formatPayoutLabel,
} from '../helpers/partnerHelpers';
import '../styles/PartnerAdmin.css';

const PartnerMonthList = ({ months = [], isAdmin = false, onMarkPaid }) => {
  const [openedClosed, setOpenedClosed] = useState({});
  const [savingPaidId, setSavingPaidId] = useState(null);

  if (!months.length) {
    return <p className="partner-empty">No invoices or monthly cashback yet.</p>;
  }

  const handleMarkPaid = async (invoice, paid) => {
    if (!onMarkPaid || !invoice?.id) return;
    setSavingPaidId(invoice.id);
    try {
      await onMarkPaid(invoice.id, paid);
    } catch (err) {
      console.error('Error updating invoice:', err);
      alert(err.message || 'Failed to update invoice.');
    } finally {
      setSavingPaidId(null);
    }
  };

  return (
    <div className="partner-month-list">
      {months.map((month) => {
        const isOpenMonth = !month.invoice;
        const isExpandedMonth = openedClosed[month.period] ?? isOpenMonth;
        const isPaid = month.invoice?.status === 'paid';
        return (
          <div key={month.period} className="partner-month-card">
            <div className="partner-month-header-row">
              <button
                type="button"
                className="partner-month-header is-toggle"
                onClick={() => {
                  setOpenedClosed((prev) => ({
                    ...prev,
                    [month.period]: !(prev[month.period] ?? isOpenMonth),
                  }));
                }}
                aria-expanded={isExpandedMonth}
              >
                <span className="partner-month-chevron">
                  {isExpandedMonth ? '▾' : '▸'}
                </span>
                <strong>{month.label}</strong>
              </button>
              <div className="partner-month-badges">
                {isOpenMonth && (
                  <span className="partner-month-badge is-open">Open</span>
                )}
                {month.invoice?.id && (
                  <a
                    className="partner-month-badge is-download"
                    href={`/api/partners/invoices/${month.invoice.id}/pdf`}
                  >
                    Download invoice
                  </a>
                )}
                {month.invoice?.id && isAdmin && (
                  <button
                    type="button"
                    className={
                      isPaid
                        ? 'partner-month-badge is-paid is-toggle'
                        : 'partner-month-badge is-unpaid is-toggle'
                    }
                    disabled={savingPaidId === month.invoice.id}
                    onClick={() => handleMarkPaid(month.invoice, !isPaid)}
                  >
                    {isPaid && <Check size={12} strokeWidth={2.5} />}
                    {isPaid ? 'Paid' : 'Not paid'}
                  </button>
                )}
                {month.invoice?.id && !isAdmin && isPaid && (
                  <span className="partner-month-badge is-paid">
                    <Check size={12} strokeWidth={2.5} />
                    Paid
                  </span>
                )}
              </div>
              <span className="partner-month-earn">{formatCents(month.earn_cents)}</span>
            </div>
            {isExpandedMonth && (
              <div className="partner-month-body">
                {month.orders.length > 0 && (
                  <table className="partner-month-orders">
                    <thead>
                      <tr>
                        <th>ORDER DATE</th>
                        <th>ORDER #</th>
                        <th>CUSTOMER NAME</th>
                        <th>SUBTOTAL</th>
                        <th>CASHBACK</th>
                        <th>METHOD</th>
                      </tr>
                    </thead>
                    <tbody>
                      {month.orders.map((order, idx) => (
                        <tr key={`${order.order_id || 'earn'}-${idx}`}>
                          <td>{formatOrderDate(order.order_date)}</td>
                          <td>{order.order_id || '—'}</td>
                          <td>
                            {order.customer_name || '—'}
                            {order.cardholder_name ? (
                              <span className="partner-cardholder-name">
                                Card: {order.cardholder_name}
                              </span>
                            ) : null}
                          </td>
                          <td>
                            {order.item_subtotal_cents != null
                              ? formatCents(order.item_subtotal_cents)
                              : '—'}
                          </td>
                          <td>{formatCents(order.amount_cents)}</td>
                          <td>{formatPayoutLabel(order.payout_type)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={4} className="partner-month-total-label">Total earnings</td>
                        <td colSpan={2}>{formatCents(month.earn_cents)}</td>
                      </tr>
                      <tr>
                        <td colSpan={4} className="partner-month-total-label">Total store credit (already applied)</td>
                        <td colSpan={2}>{formatCents(month.credit_cents)}</td>
                      </tr>
                      <tr className="partner-month-total-cash">
                        <td colSpan={4} className="partner-month-total-label">Total cash</td>
                        <td colSpan={2}>{formatCents(month.cash_cents)}</td>
                      </tr>
                      <tr className="partner-month-total-pay">
                        <td colSpan={4} className="partner-month-total-label">
                          {isAdmin ? 'Amount to pay' : 'Amount you will be paid'}
                        </td>
                        <td colSpan={2}>{formatCents(month.cash_cents)}</td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default PartnerMonthList;
