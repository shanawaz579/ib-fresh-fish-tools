import type { Bill, BusinessConfiguration } from '../../types';
import { DEFAULT_CRATE_WEIGHT_KG, getTotalWeightKg } from '../../domain/fish';
import { formatBusinessDate } from '../../utils/date';
import { formatConfiguredMoney } from '../../utils/businessFormatting';

export function buildCustomerBillShareText(
  previewBill: Bill,
  configuration: BusinessConfiguration,
  customerName?: string,
): string {
  const customer = customerName ? { name: customerName } : undefined;
  const { profile, preferences } = configuration;
  const money = (amount: number) => formatConfiguredMoney(amount, preferences, 2);

  // Recorded kilograms are authoritative; crate weight is only a legacy fallback estimate.
  const billText = `
  *${profile.display_name}*
  ${profile.tagline}
  ${profile.phone ? `📞 ${profile.phone}` : ''}
  ${profile.address || ''}

  ━━━━━━━━━━━━━━━━━━━━━━
  Bill No: ${previewBill.bill_number}
  Date: ${formatBusinessDate(previewBill.bill_date)}
  Customer: ${customer?.name || 'Unknown'}

  *Items:*
  ${(previewBill.items || []).map(item => {
    const crateWeight = item.crate_weight ?? preferences.default_crate_weight_kg ?? DEFAULT_CRATE_WEIGHT_KG;
    const totalWeight = getTotalWeightKg(item.quantity_crates, item.quantity_kg, crateWeight);
    const qtyParts = [];
    if (item.quantity_crates > 0) qtyParts.push(`${item.quantity_crates} crates`);
    if (item.quantity_kg > 0) qtyParts.push(`${item.quantity_kg} kg`);
    const qtyText = qtyParts.length > 0 ? qtyParts.join(' · ') : '0 kg';
    return `${item.fish_variety_name}
    Qty: ${qtyText}
    Total Weight: ${totalWeight.toFixed(2)} kg
    Rate: ${money(item.rate_per_kg)}/kg
    Amount: ${money(item.amount)}`;
  }).join('\n\n')}

  ${(() => {
    const itemsTotal = (previewBill.items || []).reduce((sum, item) => sum + item.amount, 0);
    const otherChargesTotal = (previewBill.other_charges || []).reduce((sum, charge) => sum + charge.amount, 0);
    let breakdown = `*Items Total:* ${money(itemsTotal)}`;

    if (previewBill.other_charges && previewBill.other_charges.length > 0) {
  breakdown += '\n\n*Other Charges:*';
  previewBill.other_charges.forEach(charge => {
    const chargeName = charge.charge_type.charAt(0).toUpperCase() + charge.charge_type.slice(1);
    const desc = charge.description ? ` (${charge.description})` : '';
    breakdown += `\n  + ${chargeName}${desc}: ${money(charge.amount)}`;
  });
  breakdown += `\n\n*Subtotal:* ${money(itemsTotal + otherChargesTotal)}`;
    }

    if (previewBill.discount > 0) {
  breakdown += `\n*Discount:* ${money(previewBill.discount)}`;
    }

    breakdown += `\n*Total:* ${money(previewBill.total)}`;

    return breakdown;
  })()}

  ${previewBill.notes ? `Notes: ${previewBill.notes}` : ''}

  ━━━━━━━━━━━━━━━━━━━━━━
  Thank you for your business!
  `.trim();

  return billText;
}
