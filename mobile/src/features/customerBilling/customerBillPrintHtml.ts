import type { Bill, BusinessConfiguration } from '../../types';
import { DEFAULT_CRATE_WEIGHT_KG, getTotalWeightKg } from '../../domain/fish';
import { formatBusinessDate } from '../../utils/date';
import { escapeHtml, formatConfiguredMoney } from '../../utils/businessFormatting';

export function buildCustomerBillPrintHtml(
  previewBill: Bill,
  configuration: BusinessConfiguration,
  customerName?: string,
): string {
  const customer = customerName ? { name: customerName } : undefined;
  const { profile, preferences } = configuration;
  const money = (amount: number) => formatConfiguredMoney(amount, preferences, 0);

  // Generate HTML for PDF (matching purchase bill format)
  const htmlContent = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      @page {
        size: A4;
        margin: 10mm;
      }
      body {
        font-family: 'Arial', sans-serif;
        padding: 0;
        margin: 0;
        font-size: 12px;
        min-height: 100vh;
        display: flex;
        flex-direction: column;
      }
      .content-wrapper {
        flex: 1;
        position: relative;
      }
      .content-wrapper::before {
        content: "🐟";
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 300px;
        opacity: 0.03;
        z-index: 0;
        pointer-events: none;
      }
      .header {
        background: linear-gradient(135deg, #f8fafc 0%, #e0f2fe 100%);
        padding: 10px 16px;
        border-bottom: 3px solid #0ea5e9;
        margin-bottom: 10px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        position: relative;
        z-index: 1;
      }
      .header-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
        font-size: 12px;
      }
      .company-name {
        font-size: 24px;
        font-weight: 900;
        color: #0f172a;
        letter-spacing: 2px;
        text-align: center;
        margin-bottom: 4px;
        text-shadow: 1px 1px 2px rgba(0,0,0,0.1);
      }
      .proprietor {
        color: #1e293b;
        font-weight: 700;
        font-size: 12px;
      }
      .contact {
        color: #0284c7;
        font-weight: 800;
        font-size: 13px;
      }
      .tagline {
        font-size: 12px;
        font-weight: 700;
        color: #475569;
        text-transform: uppercase;
        letter-spacing: 0.8px;
        text-align: center;
        margin-bottom: 4px;
      }
      .address {
        font-size: 11px;
        color: #64748b;
        text-align: center;
        font-weight: 500;
      }
      .customer-section {
        margin-bottom: 10px;
        padding: 10px;
        background: #f9fafb;
        border-radius: 6px;
        border: 1px solid #e5e7eb;
        position: relative;
        z-index: 1;
      }
      .customer-row {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
      }
      .customer-left {
        flex: 1;
      }
      .customer-right {
        text-align: right;
        background: #fff;
        padding: 8px 12px;
        border-radius: 6px;
        border: 1px solid #e5e7eb;
      }
      .customer-name {
        font-size: 16px;
        font-weight: 800;
        color: #111827;
        margin-bottom: 2px;
      }
      .total-boxes {
        font-size: 11px;
        color: #6b7280;
        font-weight: 500;
      }
      .bill-number {
        font-size: 14px;
        font-weight: 800;
        color: #0ea5e9;
        margin-bottom: 2px;
      }
      .bill-date {
        font-size: 11px;
        color: #6b7280;
        font-weight: 600;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 10px;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        overflow: hidden;
        position: relative;
        z-index: 1;
      }
      thead {
        background: linear-gradient(to bottom, #1e293b, #334155);
      }
      th {
        padding: 6px 4px;
        text-align: left;
        font-size: 11px;
        font-weight: 700;
        color: #ffffff;
        text-transform: uppercase;
        letter-spacing: 0.3px;
      }
      td {
        padding: 6px 4px;
        font-size: 12px;
        color: #111827;
        border-bottom: 1px solid #e5e7eb;
        background: #ffffff;
        vertical-align: middle;
      }
      tbody tr:nth-child(even) td {
        background: #f9fafb;
      }
      tbody tr:hover td {
        background: #f0f9ff;
      }
      .text-center {
        text-align: center;
      }
      .text-right {
        text-align: right;
      }
      .totals {
        margin-top: 10px;
        padding: 10px;
        background: linear-gradient(to bottom, #f8fafc, #ffffff);
        border-radius: 6px;
        border: 1px solid #e5e7eb;
        position: relative;
        z-index: 1;
      }
      .total-row {
        display: flex;
        justify-content: space-between;
        margin-bottom: 4px;
        font-size: 12px;
        padding: 1px 0;
      }
      .total-label {
        color: #475569;
        font-weight: 600;
      }
      .total-value {
        font-weight: 700;
        color: #111827;
      }
      .charge-row {
        padding-left: 20px;
        border-left: 3px solid #e0f2fe;
      }
      .charge-label {
        font-weight: 500;
        font-size: 12px;
        color: #64748b;
      }
      .charge-value {
        font-size: 12px;
        color: #059669;
        font-weight: 700;
      }
      .separator {
        height: 1px;
        background: linear-gradient(to right, #e5e7eb, #cbd5e1, #e5e7eb);
        margin: 6px 0;
      }
      .grand-total {
        margin-top: 8px;
        padding: 8px;
        border-top: 3px solid #3b82f6;
        background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
        border-radius: 6px;
      }
      .grand-total .total-label {
        font-size: 15px;
        font-weight: 900;
        color: #1e3a8a;
        text-transform: uppercase;
        letter-spacing: 0.8px;
      }
      .grand-total .total-value {
        font-size: 18px;
        font-weight: 900;
        color: #1e40af;
      }
      .payment-paid {
        color: #059669;
        font-weight: 700;
      }
      .payment-due {
        color: #DC2626;
        font-weight: 700;
      }
      .notes {
        margin-top: 10px;
        padding-top: 10px;
        border-top: 1px solid #e5e7eb;
      }
      .notes-title {
        font-size: 9px;
        font-weight: 600;
        color: #6b7280;
        margin-bottom: 3px;
      }
      .notes-text {
        font-size: 10px;
        color: #374151;
        font-style: italic;
      }
      .footer {
        margin-top: auto;
        padding-top: 10px;
        padding-bottom: 8px;
        border-top: 3px double #cbd5e1;
        text-align: center;
        background: linear-gradient(to top, #f8fafc, transparent);
      }
      .footer-text {
        font-size: 13px;
        font-weight: 700;
        color: #059669;
        letter-spacing: 0.4px;
      }
    </style>
  </head>
  <body>
    <div class="content-wrapper">
      <div class="header">
        <div class="header-top">
          <span class="proprietor">${escapeHtml(profile.legal_name || profile.display_name)}</span>
          <span class="contact">${profile.phone ? `📞 ${escapeHtml(profile.phone)}` : ''}</span>
        </div>
        <div class="company-name">${escapeHtml(profile.display_name)}</div>
        <div class="tagline">${escapeHtml(profile.tagline)}</div>
        <div class="address">${escapeHtml(profile.address)}</div>
      </div>

      <div class="customer-section">
        <div class="customer-row">
          <div class="customer-left">
            <div class="customer-name">${customer?.name || 'Unknown'}</div>
            <div class="total-boxes">Total: ${(previewBill.items || []).reduce((sum, item) => sum + item.quantity_crates, 0)} boxes</div>
          </div>
          <div class="customer-right">
            <div class="bill-number">${previewBill.bill_number}</div>
            <div class="bill-date">${formatBusinessDate(previewBill.bill_date)}</div>
          </div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th class="text-center">Qty</th>
            <th class="text-center">Weight (kg)</th>
            <th class="text-center">Rate (${escapeHtml(preferences.currency_symbol)}/kg)</th>
            <th class="text-right">Amount (${escapeHtml(preferences.currency_symbol)})</th>
          </tr>
        </thead>
        <tbody>
          ${(previewBill.items || []).map(item => {
            const crateWeight = item.crate_weight ?? preferences.default_crate_weight_kg ?? DEFAULT_CRATE_WEIGHT_KG;
            const totalWeight = getTotalWeightKg(item.quantity_crates, item.quantity_kg, crateWeight);
            let qtyText = '';
            if (item.quantity_crates > 0 && item.quantity_kg > 0) {
              qtyText = `${item.quantity_crates} cr · ${item.quantity_kg} kg`;
            } else if (item.quantity_crates > 0) {
              qtyText = `${item.quantity_crates} cr`;
            } else if (item.quantity_kg > 0) {
              qtyText = `${item.quantity_kg} kg`;
            } else {
              qtyText = '0';
            }
            return `
            <tr>
              <td>${item.fish_variety_name}</td>
              <td class="text-center">${qtyText}</td>
              <td class="text-center">${totalWeight}</td>
              <td class="text-center">${item.rate_per_kg}</td>
              <td class="text-right">${money(item.amount)}</td>
            </tr>
            `;
          }).join('')}
        </tbody>
      </table>

      <div class="totals">
        ${(() => {
          const itemsTotal = (previewBill.items || []).reduce((sum, item) => sum + item.amount, 0);
          const otherChargesTotal = (previewBill.other_charges || []).reduce((sum, charge) => sum + charge.amount, 0);
          const subtotal = itemsTotal + otherChargesTotal;
          let html = '';

          // Previous Balance Section
          if (previewBill.previous_balance && previewBill.previous_balance > 0) {
            html += `
              <div class="total-row">
                <span class="total-label">Previous Balance:</span>
                <span class="total-value">${money(previewBill.previous_balance)}</span>
              </div>
            `;
          }

          // Payments Received - Show independently of previous balance
          if (previewBill.payments && previewBill.payments.length > 0) {
            html += `<div style="margin-top: 8px; margin-bottom: 4px; font-weight: 600; font-size: 11px; color: #059669;">Less: Payments Received</div>`;
            previewBill.payments.forEach(payment => {
              const paymentDate = formatBusinessDate(payment.payment_date);
              const paymentMethod = payment.payment_method.toUpperCase();
              html += `
                <div class="total-row charge-row">
                  <span class="charge-label">${paymentDate} - ${paymentMethod}:</span>
                  <span class="total-value payment-paid">${money(payment.amount)}</span>
                </div>
              `;
            });

            // Show Credit Balance / Balance Outstanding after payments
            const balanceLabel = previewBill.balance_due < 0 ? 'Credit Balance:' : 'Balance Outstanding:';
            html += `
              <div class="total-row">
                <span class="total-label">${balanceLabel}</span>
                <span class="total-value ${previewBill.balance_due < 0 ? 'payment-paid' : 'payment-due'}">${money(Math.abs(previewBill.balance_due))}</span>
              </div>
            `;
          }

          // Separator after previous balance/payments section
          if ((previewBill.previous_balance && previewBill.previous_balance > 0) || (previewBill.payments && previewBill.payments.length > 0)) {
            html += `<div class="separator"></div>`;
          }

          // Current Bill Items
          html += `
            <div class="total-row">
              <span class="total-label">Items Total:</span>
              <span class="total-value">${money(itemsTotal)}</span>
            </div>
          `;

          // Other Charges
          if (previewBill.other_charges && previewBill.other_charges.length > 0) {
            previewBill.other_charges.forEach(charge => {
              const chargeName = charge.charge_type.charAt(0).toUpperCase() + charge.charge_type.slice(1);
              html += `
                <div class="total-row charge-row">
                  <span class="charge-label">+ ${chargeName}${charge.description ? ` (${charge.description})` : ''}:</span>
                  <span class="charge-value">${money(charge.amount)}</span>
                </div>
              `;
            });
          }

          // Discount
          if (previewBill.discount > 0) {
            html += `
              <div class="total-row charge-row">
                <span class="charge-label">- Discount:</span>
                <span class="total-value payment-due">${money(previewBill.discount)}</span>
              </div>
            `;
          }

          // Current Bill Subtotal (if there are charges or discount)
          if (otherChargesTotal > 0 || previewBill.discount > 0) {
            html += `
              <div class="total-row">
                <span class="total-label">Current Bill Subtotal:</span>
                <span class="total-value">${money(subtotal - previewBill.discount)}</span>
              </div>
            `;
          }

          // Grand Total
          html += `
            <div class="total-row grand-total">
              <span class="total-label">TOTAL DUE:</span>
              <span class="total-value">${money(previewBill.total)}</span>
            </div>
          `;

          return html;
        })()}

        ${previewBill.notes ? `
        <div class="notes">
          <div class="notes-title">Notes:</div>
          <div class="notes-text">${previewBill.notes}</div>
        </div>
        ` : ''}
      </div>
    </div>

    <div class="footer">
      <div class="footer-text">Thank you for your business!</div>
    </div>
  </body>
  </html>
  `;

  return htmlContent;
}
