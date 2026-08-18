import { useState } from 'react';
import {
  formatCents,
  formatInvoiceSummary,
  formatOrderDate,
  formatPayoutLabel,
} from '../helpers/partnerHelpers';
import '../styles/PartnerAdmin.css';

const PartnerMonthList = ({ months = [] }) => {
  const [openedClosed, setOpenedClosed] = useState({});

  if (!months.length) {
    return <p className="partner-empty">No invoices or monthly cashback yet.</p>;
  }

  return (
    <div className="partner-month-list">
      {months.map((month) => {
        const isOpenMonth = !month.invoice;
        const isExpandedMonth = isOpenMonth || !!openedClosed[month.period];
        return (
          <div key={month.period} className="partner-month-card">
            <button
              type="button"
              className={
                isOpenMonth
                  ? 'partner-month-header'
                  : 'partner-month-header is-toggle'
              }
              onClick={() => {
                if (!isOpenMonth) {
                  setOpenedClosed((prev) => ({
                    ...prev,
                    [month.period]: !prev[month.period],
                  }));
                }
              }}
              disabled={isOpenMonth}
              aria-expanded={isExpandedMonth}
            >
              <div className="partner-month-title">
                {!isOpenMonth && (
                  <span className="partner-month-chevron">
                    {isExpandedMonth ? '▾' : '▸'}
                  </span>
                )}
                <strong>{month.label}</strong>
                <span
                  className={
                    isOpenMonth
                      ? 'partner-month-badge is-open'
                      : 'partner-month-badge is-closed'
                  }
                >
                  {isOpenMonth ? 'Open' : 'Closed'}
                </span>
              </div>
              <span>{formatCents(month.earn_cents)}</span>
            </button>
            {isExpandedMonth && (
              <div className="partner-month-body">
                <p className="partner-month-meta">
                  Invoice: {formatInvoiceSummary(month.invoice)}
                </p>
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
                          <td>{order.customer_name || '—'}</td>
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
                        <td colSpan={4} className="partner-month-total-label">TOTAL CASH</td>
                        <td colSpan={2}>{formatCents(month.cash_cents)}</td>
                      </tr>
                      <tr>
                        <td colSpan={4} className="partner-month-total-label">TOTAL CREDIT</td>
                        <td colSpan={2}>{formatCents(month.credit_cents)}</td>
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
