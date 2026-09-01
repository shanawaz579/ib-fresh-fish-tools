import type { PurchaseBillDetails } from '../../domain/purchaseBillDetails';
import type { BusinessConfiguration } from '../../types';
import { formatBusinessDate } from '../../utils/date';
import { escapeHtml, formatConfiguredMoney } from '../../utils/businessFormatting';
import { PURCHASE_BILL_PRINT_CSS } from './purchaseBillPrintStyles';

export function generatePurchaseBillHtml(
  bill: PurchaseBillDetails,
  configuration: BusinessConfiguration,
): string {
  const { profile, preferences } = configuration;
  const money = (amount: number, digits = 0) => formatConfiguredMoney(amount, preferences, digits);
  const activePayments = bill.payments.filter((payment) => !payment.voided_at);
  const itemsHTML = bill.items.map((item) => {
    let qtyText = '';
    if (item.quantity_crates > 0 && item.quantity_kg > 0) {
      qtyText = `${item.quantity_crates} cr · ${item.quantity_kg} kg`;
    } else if (item.quantity_crates > 0) {
      qtyText = `${item.quantity_crates} cr`;
    } else if (item.quantity_kg > 0) {
      qtyText = `${item.quantity_kg} kg`;
    } else {
      qtyText = '0 kg';
    }

    return `
    <tr>
      <td>${escapeHtml(item.fish_variety_name)}</td>
      <td class="text-center">${qtyText}</td>
      <td class="text-center">${item.billable_weight}</td>
      <td class="text-center">${item.rate_per_kg}</td>
      <td class="text-right">${money(item.amount)}</td>
    </tr>
    `;
  }).join('');

  const otherDeductionsHTML = bill.other_deductions.map((deduction) => {
    const isAddition = deduction.type === 'other_charges_addition';

    let displayName = '';
    if (deduction.type === 'other_charges_addition') {
      displayName = 'Other charges (+)';
    } else if (deduction.type === 'other_charges_deduction') {
      displayName = 'Other charges (-)';
    } else {
      displayName = deduction.type.charAt(0).toUpperCase() + deduction.type.slice(1).replace(/_/g, ' ');
    }

    const prefix = isAddition ? '+' : '-';
    const cssClass = isAddition ? 'charge-value' : 'deduction-value';

    return `
      <div class="total-row charge-row">
        <span class="total-label charge-label">${prefix} ${displayName}:</span>
        <span class="total-value ${cssClass}">${money(deduction.amount)}</span>
      </div>
    `;
  }).join('');

  const paymentsHTML = activePayments.length > 0 ? activePayments.map((payment) => `
    <tr>
      <td>${formatBusinessDate(payment.payment_date)}</td>
      <td class="text-center">${payment.payment_mode.toUpperCase()}</td>
      <td class="text-right payment-amount-cell">${money(payment.amount)}</td>
      <td class="payment-notes-cell">${escapeHtml([payment.reference_number ? `Ref: ${payment.reference_number}` : '', payment.notes || ''].filter(Boolean).join(' · ') || '-')}</td>
    </tr>
  `).join('') : '';

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          ${PURCHASE_BILL_PRINT_CSS}\n        </style>
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

          <div class="farmer-section">
          <div class="farmer-row">
            <div class="farmer-left">
              <div class="farmer-name">${escapeHtml(bill.supplier_name)}</div>
              ${(bill.location || bill.secondary_name) ? `
                <div class="farmer-details">
                  ${bill.location ? escapeHtml(bill.location) : ''}
                  ${bill.location && bill.secondary_name ? ' • ' : ''}
                  ${bill.secondary_name ? escapeHtml(bill.secondary_name) : ''}
                </div>
              ` : ''}
            </div>
            <div class="farmer-right">
              <div class="bill-number">${bill.bill_number}</div>
              <div class="bill-date">${formatBusinessDate(bill.bill_date)}</div>
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
            ${itemsHTML}
          </tbody>
        </table>

        <div class="totals">
          <div class="total-row">
            <span class="total-label">Subtotal:</span>
            <span class="total-value">${money(bill.subtotal)}</span>
          </div>

          ${bill.commission_amount > 0 ? `
            <div class="total-row charge-row">
              <span class="total-label charge-label">+ Commission (${escapeHtml(preferences.currency_symbol)}${bill.commission_per_kg.toFixed(2)}/kg):</span>
              <span class="total-value charge-value">${money(bill.commission_amount, 2)}</span>
            </div>
          ` : ''}

          ${otherDeductionsHTML}

          <div class="total-row grand-total">
            <span class="total-label">TOTAL DUE:</span>
            <span class="total-value">${money(bill.total)}</span>
          </div>

          ${activePayments.length > 0 ? `
            <div class="separator"></div>

            <div class="total-row">
              <span class="total-label">Amount Paid:</span>
              <span class="total-value payment-paid">${money(bill.amount_paid)}</span>
            </div>

            <div class="total-row">
              <span class="total-label">Balance Due:</span>
              <span class="total-value payment-due">${money(bill.balance_due)}</span>
            </div>
          ` : ''}
        </div>

          ${activePayments.length > 0 ? `
          <div class="payment-details-section">
            <div class="payment-details-title">Payment Details</div>
            <table class="payment-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th class="text-center">Mode</th>
                  <th class="text-right">Amount</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                ${paymentsHTML}
              </tbody>
            </table>
          </div>
          ` : ''}

          ${bill.notes ? `
          <div class="notes">
            <div class="notes-title">Notes:</div>
            <div class="notes-text">${bill.notes}</div>
          </div>
          ` : ''}

          <div class="payment-space">
            <div class="payment-space-title">Payment Records</div>
            <div class="payment-space-subtitle">Use this space to record payment details manually</div>
          </div>
        </div>

        <div class="footer">
          <div class="footer-text">
            Thank you for your business!
          </div>
        </div>
      </body>
    </html>
  `;
}
