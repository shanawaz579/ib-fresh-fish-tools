import type { Bill, BusinessConfiguration } from '../../types';
import { DEFAULT_CRATE_WEIGHT_KG, getTotalWeightKg, sortFishItems } from '../../domain/fish';
import { formatBusinessDate } from '../../utils/date';
import { escapeHtml, formatConfiguredMoney } from '../../utils/businessFormatting';
import { getBusinessBillBranding } from '../billing/businessBillBranding';

export function buildCustomerBillPrintHtml(
  previewBill: Bill,
  configuration: BusinessConfiguration,
  customerName?: string,
): string {
  const customer = customerName ? { name: customerName } : undefined;
  const { profile, preferences } = configuration;
  const money = (amount: number) => formatConfiguredMoney(amount, preferences, 0);
  const branding = getBusinessBillBranding(profile);

  // Generate HTML for PDF (matching purchase bill format)
  const htmlContent = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      @page {
        size: A5 portrait;
        margin: 5mm;
      }
      html {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      body {
        font-family: 'Arial', sans-serif;
        background: #ffffff;
        padding: 0;
        margin: 0;
        color: #111827;
        font-size: 14px;
        line-height: 1.4;
        min-height: 100%;
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
        font-size: 180px;
        opacity: 0.03;
        z-index: 0;
        pointer-events: none;
      }
      .header {
        padding: 6px 2px 9px;
        border-bottom: 2px solid #0f766e;
        margin-bottom: 10px;
        position: relative;
        z-index: 1;
      }
      .header-main {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        gap: 12px;
      }
      .company-name {
        font-size: 24px;
        font-weight: 900;
        color: #0f172a;
        letter-spacing: 0.2px;
      }
      .document-title {
        color: #0f766e;
        font-weight: 800;
        font-size: 11px;
        letter-spacing: 1px;
        text-transform: uppercase;
      }
      .proprietor {
        margin-top: 2px;
        font-size: 10px;
        color: #334155;
        font-weight: 700;
      }
      .tagline {
        margin-top: 3px;
        font-size: 10px;
        color: #0f766e;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.3px;
      }
      .business-details {
        margin-top: 3px;
        font-size: 9.5px;
        color: #64748b;
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
        table-layout: fixed;
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
        padding: 7px 3px;
        text-align: left;
        font-size: 10px;
        font-weight: 700;
        color: #ffffff;
        text-transform: uppercase;
        letter-spacing: 0.3px;
      }
      td {
        padding: 7px 3px;
        font-size: 12px;
        color: #111827;
        border-bottom: 1px solid #e5e7eb;
        background: #ffffff;
        vertical-align: middle;
        overflow-wrap: anywhere;
      }
      tbody tr:nth-child(even) td {
        background: #f9fafb;
      }
      tbody tr:hover td {
        background: #f0f9ff;
      }
      .item-list {
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        overflow: hidden;
        margin-bottom: 10px;
        position: relative;
        z-index: 1;
      }
      .item-row {
        padding: 8px 10px;
        border-bottom: 1px solid #e2e8f0;
        break-inside: avoid;
        page-break-inside: avoid;
      }
      .item-row:last-child { border-bottom: 0; }
      .item-main, .item-meta {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 10px;
      }
      .item-name { font-size: 13px; font-weight: 800; color: #0f172a; }
      .item-amount { font-size: 13px; font-weight: 900; color: #0f766e; white-space: nowrap; }
      .item-meta { margin-top: 3px; font-size: 10.5px; color: #64748b; }
      .item-rate { white-space: nowrap; }
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
        break-inside: avoid;
        page-break-inside: avoid;
      }
      .total-row {
        display: flex;
        justify-content: space-between;
        margin-bottom: 4px;
        font-size: 13px;
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
        font-size: 12.5px;
        color: #64748b;
      }
      .charge-value {
        font-size: 12.5px;
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
        <div class="header-main">
          <div class="company-name">${escapeHtml(branding.name)}</div>
          <div class="document-title">Sales Bill</div>
        </div>
        ${branding.proprietor ? `<div class="proprietor">${escapeHtml(branding.proprietor)}</div>` : ''}
        <div class="tagline">${escapeHtml(branding.tagline)}</div>
        ${branding.contactLine ? `<div class="business-details">${escapeHtml(branding.contactLine)}</div>` : ''}
      </div>

      <div class="customer-section">
        <div class="customer-row">
          <div class="customer-left">
            <div class="customer-name">${escapeHtml(customer?.name || 'Unknown')}</div>
            <div class="total-boxes">Total: ${(previewBill.items || []).reduce((sum, item) => sum + item.quantity_crates, 0)} boxes</div>
          </div>
          <div class="customer-right">
            <div class="bill-number">${escapeHtml(previewBill.bill_number)}</div>
            <div class="bill-date">${formatBusinessDate(previewBill.bill_date)}</div>
          </div>
        </div>
      </div>

      <div class="item-list">
          ${sortFishItems(previewBill.items || [], item => item.fish_variety_name).map(item => {
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
            <div class="item-row">
              <div class="item-main">
                <span class="item-name">${escapeHtml(item.fish_variety_name)}</span>
                <span class="item-amount">${money(item.amount)}</span>
              </div>
              <div class="item-meta">
                <span>${escapeHtml(qtyText)} | ${totalWeight} kg</span>
                <span class="item-rate">${money(item.rate_per_kg)}/kg</span>
              </div>
            </div>
            `;
          }).join('')}
      </div>

      <div class="totals">
        ${(() => {
          const itemsTotal = (previewBill.items || []).reduce((sum, item) => sum + item.amount, 0);
          const otherChargesTotal = (previewBill.other_charges || []).reduce((sum, charge) => sum + charge.amount, 0);
          const subtotal = itemsTotal + otherChargesTotal;
          const paymentsTotal = (previewBill.payments || []).reduce((sum, payment) => sum + payment.amount, 0);
          const balanceAfterPayments = previewBill.previous_balance - paymentsTotal;
          let html = '';

          // Previous Balance Section
          if (previewBill.previous_balance !== 0) {
            html += `
              <div class="total-row">
                <span class="total-label">${previewBill.previous_balance < 0 ? 'Customer Credit Brought Forward:' : 'Previous Balance:'}</span>
                <span class="total-value">${previewBill.previous_balance < 0 ? '−' : ''}${money(Math.abs(previewBill.previous_balance))}</span>
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

            // Show the brought-forward balance after receipts. Current bill
            // charges are added below before displaying the final total due.
            const balanceLabel = balanceAfterPayments < 0 ? 'Credit after payments:' : 'Balance after payments:';
            html += `
              <div class="total-row">
                <span class="total-label">${balanceLabel}</span>
                <span class="total-value ${balanceAfterPayments < 0 ? 'payment-paid' : 'payment-due'}">${balanceAfterPayments < 0 ? '−' : ''}${money(Math.abs(balanceAfterPayments))}</span>
              </div>
            `;
          }

          // Separator after previous balance/payments section
          if (previewBill.previous_balance !== 0 || (previewBill.payments && previewBill.payments.length > 0)) {
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
