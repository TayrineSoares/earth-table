const PDFDocument = require('pdfkit');

function money(cents) {
  return `$${((Number(cents) || 0) / 100).toFixed(2)}`;
}

function payoutLabel(type) {
  return type === 'credit' ? 'Store credit' : 'Cash';
}

function statusLabel(status) {
  if (status === 'paid') return 'Paid';
  if (status === 'credited') return 'Credited';
  if (status === 'unpaid') return 'Unpaid';
  return status || '—';
}

function formatDate(iso) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function clip(text, max) {
  const value = String(text || '—');
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

function formatPhone(phone) {
  if (!phone) return null;
  const cleaned = String(phone).replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return String(phone);
}

function renderPartnerInvoicePdf({ invoice, partner, user, periodLabel, orders }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 50 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const partnerName = [user?.first_name, user?.last_name].filter(Boolean).join(' ')
      || user?.email
      || 'Partner';
    const cash = Number(invoice.cash_cents) || 0;
    const credit = Number(invoice.credit_cents) || 0;

    doc.fillColor('#000000')
      .font('Helvetica-Bold')
      .fontSize(22)
      .text('Earth Table Co', { align: 'left' });
    doc.font('Helvetica')
      .fontSize(11)
      .fillColor('#BE7200')
      .text('Partner statement', { align: 'left' });

    doc.moveDown(1.2);
    doc.fillColor('#000000').fontSize(10);
    doc.text(`Partner: ${partnerName}`);
    if (user?.email) doc.text(`Email: ${user.email}`);
    const phone = formatPhone(user?.phone_number);
    if (phone) doc.text(`Phone: ${phone}`);
    doc.text(`Referral code: ${partner.referral_code || '—'}`);
    doc.text(`Period: ${periodLabel}`);
    doc.text(`Status: ${statusLabel(invoice.status)}`);

    doc.moveDown(1);
    const tableTop = doc.y;
    const cols = [
      { x: 50, w: 95, label: 'Order date' },
      { x: 145, w: 55, label: 'Order #' },
      { x: 200, w: 130, label: 'Customer' },
      { x: 330, w: 70, label: 'Subtotal' },
      { x: 400, w: 70, label: 'Cashback' },
      { x: 470, w: 90, label: 'Method' },
    ];

    doc.rect(50, tableTop, 512, 20).fill('#FEE8D4');
    doc.fillColor('#000000').font('Helvetica-Bold').fontSize(8);
    cols.forEach((col) => {
      doc.text(col.label.toUpperCase(), col.x + 4, tableTop + 6, {
        width: col.w - 8,
        lineBreak: false,
      });
    });

    let y = tableTop + 22;
    doc.font('Helvetica').fontSize(9);

    const rows = orders.length
      ? orders
      : [{ order_date: null, order_id: null, customer_name: 'No referred orders', item_subtotal_cents: null, amount_cents: 0, payout_type: null }];

    rows.forEach((order, idx) => {
      if (y > 700) {
        doc.addPage();
        y = 50;
      }
      if (idx % 2 === 1) {
        doc.rect(50, y - 4, 512, 18).fill('#fffaf4');
        doc.fillColor('#000000');
      }
      const cells = [
        formatDate(order.order_date),
        order.order_id ? String(order.order_id) : '—',
        clip(order.customer_name, 28),
        order.item_subtotal_cents != null ? money(order.item_subtotal_cents) : '—',
        money(order.amount_cents),
        order.payout_type ? payoutLabel(order.payout_type) : '—',
      ];
      cells.forEach((value, i) => {
        doc.fillColor('#000000').text(value, cols[i].x + 4, y, {
          width: cols[i].w - 8,
          lineBreak: false,
        });
      });
      y += 18;
    });

    y += 10;
    doc.font('Helvetica-Bold').fontSize(10);
    doc.text(`Total cash: ${money(cash)}`, 50, y, { align: 'right', width: 512 });
    y += 16;
    doc.text(`Total store credit: ${money(credit)}`, 50, y, { align: 'right', width: 512 });
    y += 16;
    doc.text(`Total: ${money(cash + credit)}`, 50, y, { align: 'right', width: 512 });

    doc.moveDown(2);
    doc.font('Helvetica').fontSize(9).fillColor('#4b5563');
    doc.text(
      'Cash is invoiced at month-end. Store credit is added to the partner wallet and applied automatically on their next order.',
      50,
      doc.y,
      { width: 512 }
    );

    doc.end();
  });
}

module.exports = {
  renderPartnerInvoicePdf,
  money,
};
