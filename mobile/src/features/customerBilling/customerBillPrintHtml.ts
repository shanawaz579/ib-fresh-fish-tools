import type { Bill, BusinessConfiguration } from '../../types';
import { DEFAULT_CRATE_WEIGHT_KG, getTotalWeightKg, sortFishItems } from '../../domain/fish';
import { formatBusinessDate } from '../../utils/date';
import { escapeHtml, formatConfiguredMoney } from '../../utils/businessFormatting';
import { getBusinessBillBranding } from '../billing/businessBillBranding';
import { BRAND_COLORS, BRAND_FONT_FAMILY } from '../../config/brandTheme';

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
        font-family: ${BRAND_FONT_FAMILY};
        background: #ffffff;
        padding: 0;
        margin: 0;
        color: ${BRAND_COLORS.ink};
        font-size: 11px;
        line-height: 1.3;
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
        padding: 3px 1px 6px;
        border-bottom: 2px solid ${BRAND_COLORS.primary};
        margin-bottom: 7px;
        position: relative;
        z-index: 1;
      }
      .header-main {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
      }
      .company-name {
        font-size: 21px;
        font-weight: 900;
        color: ${BRAND_COLORS.ink};
        letter-spacing: 0.2px;
      }
      .document-title {
        color: ${BRAND_COLORS.primary};
        font-weight: 800;
        font-size: 10px;
        letter-spacing: 1px;
        text-transform: uppercase;
      }
      .identity-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 1px; font-size: 9px; color: ${BRAND_COLORS.ink}; font-weight: 700; }
      .proprietor { min-width: 0; }
      .phone { color: ${BRAND_COLORS.primary}; white-space: nowrap; }
      .phone-label { color: ${BRAND_COLORS.muted}; font-weight: 600; }
      .phone-number { font-size: 10px; font-weight: 800; }
      .tagline {
        margin-top: 2px;
        font-size: 9px;
        color: ${BRAND_COLORS.primary};
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.3px;
      }
      .business-details {
        margin-top: 1px;
        font-size: 8px;
        color: ${BRAND_COLORS.muted};
        font-weight: 500;
      }
      .customer-section {
        margin-bottom: 7px;
        padding: 6px 8px;
        background: ${BRAND_COLORS.primarySoft};
        border-radius: 5px;
        border: 1px solid ${BRAND_COLORS.border};
        position: relative;
        z-index: 1;
      }
      .customer-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .customer-left {
        flex: 1;
      }
      .customer-right { text-align: right; }
      .customer-name {
        font-size: 13px;
        font-weight: 800;
        color: ${BRAND_COLORS.ink};
        margin-bottom: 1px;
      }
      .total-boxes {
        font-size: 9px;
        color: ${BRAND_COLORS.muted};
        font-weight: 500;
      }
      .bill-number {
        font-size: 11px;
        font-weight: 800;
        color: ${BRAND_COLORS.primary};
        margin-bottom: 1px;
      }
      .bill-date {
        font-size: 9px;
        color: ${BRAND_COLORS.muted};
        font-weight: 600;
      }
      table {
        width: 100%;
        table-layout: fixed;
        border-collapse: collapse;
        margin-bottom: 7px;
        border: 1px solid ${BRAND_COLORS.border};
        border-radius: 6px;
        overflow: hidden;
        position: relative;
        z-index: 1;
      }
      thead {
        background: ${BRAND_COLORS.ink};
      }
      th {
        padding: 5px 4px;
        text-align: left;
        font-size: 8px;
        font-weight: 700;
        color: #ffffff;
        text-transform: uppercase;
        letter-spacing: 0.3px;
      }
      td {
        padding: 5px 4px;
        font-size: 9.5px;
        color: ${BRAND_COLORS.ink};
        border-bottom: 1px solid ${BRAND_COLORS.border};
        background: #ffffff;
        vertical-align: middle;
        overflow-wrap: anywhere;
      }
      tbody tr:nth-child(even) td {
        background: ${BRAND_COLORS.primarySoft};
      }
      tbody tr:hover td {
        background: ${BRAND_COLORS.primarySoft};
      }
      .item-name { font-weight: 800; }
      .item-amount { color: ${BRAND_COLORS.primary}; font-weight: 800; white-space: nowrap; }
      .nowrap { white-space: nowrap; }
      .text-center {
        text-align: center;
      }
      .text-right {
        text-align: right;
      }
      .totals {
        margin-top: 7px;
        padding: 7px 8px;
        background: ${BRAND_COLORS.surface};
        border-radius: 5px;
        border: 1px solid ${BRAND_COLORS.border};
        position: relative;
        z-index: 1;
        break-inside: avoid;
        page-break-inside: avoid;
      }
      .total-row {
        display: flex;
        justify-content: space-between;
        margin-bottom: 2px;
        font-size: 10px;
        padding: 1px 0;
      }
      .total-label {
        color: ${BRAND_COLORS.muted};
        font-weight: 600;
      }
      .total-value {
        font-weight: 700;
        color: ${BRAND_COLORS.ink};
      }
      .charge-row {
        padding-left: 20px;
        border-left: 3px solid ${BRAND_COLORS.primarySoftStrong};
      }
      .charge-label {
        font-weight: 500;
        font-size: 9.5px;
        color: ${BRAND_COLORS.muted};
      }
      .charge-value {
        font-size: 9.5px;
        color: ${BRAND_COLORS.primary};
        font-weight: 700;
      }
      .separator {
        height: 1px;
        background: ${BRAND_COLORS.border};
        margin: 4px 0;
      }
      .grand-total {
        margin-top: 5px;
        padding: 6px;
        border-top: 3px solid ${BRAND_COLORS.primary};
        background: ${BRAND_COLORS.primarySoftStrong};
        border-radius: 5px;
      }
      .grand-total .total-label {
        font-size: 11px;
        font-weight: 900;
        color: ${BRAND_COLORS.ink};
        text-transform: uppercase;
        letter-spacing: 0.8px;
      }
      .grand-total .total-value {
        font-size: 14px;
        font-weight: 900;
        color: ${BRAND_COLORS.primary};
      }
      .payment-paid {
        color: ${BRAND_COLORS.primary};
        font-weight: 700;
      }
      .payment-due {
        color: #DC2626;
        font-weight: 700;
      }
      .notes {
        margin-top: 6px;
        padding-top: 6px;
        border-top: 1px solid ${BRAND_COLORS.border};
      }
      .notes-title {
        font-size: 9px;
        font-weight: 600;
        color: ${BRAND_COLORS.muted};
        margin-bottom: 3px;
      }
      .notes-text {
        font-size: 10px;
        color: ${BRAND_COLORS.ink};
        font-style: italic;
      }
      .footer {
        margin-top: auto;
        padding-top: 6px;
        padding-bottom: 3px;
        border-top: 3px double ${BRAND_COLORS.border};
        text-align: center;
        background: ${BRAND_COLORS.surface};
      }
      .footer-text {
        font-size: 10px;
        font-weight: 700;
        color: ${BRAND_COLORS.primary};
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
        <div class="identity-row">
          ${branding.proprietor ? `<div class="proprietor">${escapeHtml(branding.proprietor)}</div>` : '<span></span>'}
          ${branding.phone ? `<div class="phone"><span class="phone-label">Mobile:</span> <span class="phone-number">${escapeHtml(branding.phone)}</span></div>` : ''}
        </div>
        <div class="tagline">${escapeHtml(branding.tagline)}</div>
        ${branding.address ? `<div class="business-details">${escapeHtml(branding.address)}</div>` : ''}
      </div>

      <div class="customer-section">
        <div class="customer-row">
          <div class="customer-left">
            <div class="customer-name">${escapeHtml(customer?.name || 'Unknown')}</div>
            <div class="total-boxes">Total: ${(previewBill.items || []).reduce((sum, item) => sum + item.quantity_crates, 0)} cr</div>
          </div>
          <div class="customer-right">
            <div class="bill-number">${escapeHtml(previewBill.bill_number)}</div>
            <div class="bill-date">${formatBusinessDate(previewBill.bill_date)}</div>
          </div>
        </div>
      </div>

      <table class="items-table">
        <colgroup><col style="width:35%"><col style="width:16%"><col style="width:17%"><col style="width:13%"><col style="width:19%"></colgroup>
        <thead><tr><th>Item</th><th class="text-center">Qty (cr)</th><th class="text-right">Wt (kg)</th><th class="text-right">${escapeHtml(preferences.currency_symbol)}/kg</th><th class="text-right">Amount (${escapeHtml(preferences.currency_symbol)})</th></tr></thead>
        <tbody>
          ${sortFishItems(previewBill.items || [], item => item.fish_variety_name).map(item => {
            const crateWeight = item.crate_weight ?? preferences.default_crate_weight_kg ?? DEFAULT_CRATE_WEIGHT_KG;
            const totalWeight = getTotalWeightKg(item.quantity_crates, item.quantity_kg, crateWeight);
            let qtyText = '';
            if (item.quantity_crates > 0 && item.quantity_kg > 0) {
              qtyText = `${item.quantity_crates} + ${item.quantity_kg} kg`;
            } else if (item.quantity_crates > 0) {
              qtyText = `${item.quantity_crates}`;
            } else if (item.quantity_kg > 0) {
              qtyText = `${item.quantity_kg} kg`;
            } else {
              qtyText = '0';
            }
            return `<tr>
              <td class="item-name">${escapeHtml(item.fish_variety_name)}</td>
              <td class="text-center nowrap">${escapeHtml(qtyText)}</td>
              <td class="text-right nowrap">${totalWeight}</td>
              <td class="text-right nowrap">${money(item.rate_per_kg).replace(preferences.currency_symbol, '')}</td>
              <td class="text-right item-amount">${money(item.amount).replace(preferences.currency_symbol, '')}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>

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
