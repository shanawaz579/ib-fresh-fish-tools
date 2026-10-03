import { BRAND_COLORS, BRAND_FONT_FAMILY } from '../../config/brandTheme';

export const PURCHASE_BILL_PRINT_CSS = `
  @page { size: A5 portrait; margin: 5mm; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body {
    background: ${BRAND_COLORS.surface};
    color: ${BRAND_COLORS.ink};
    display: flex;
    flex-direction: column;
    font-family: ${BRAND_FONT_FAMILY};
    font-size: 11px;
    line-height: 1.3;
    margin: 0;
    min-height: 100%;
    padding: 0;
  }
  .content-wrapper { flex: 1; position: relative; }
  .content-wrapper::before {
    content: "🐟";
    font-size: 180px;
    left: 50%;
    opacity: .025;
    pointer-events: none;
    position: absolute;
    top: 50%;
    transform: translate(-50%, -50%);
    z-index: 0;
  }
  .header {
    border-bottom: 2px solid ${BRAND_COLORS.primary};
    margin-bottom: 7px;
    padding: 3px 1px 6px;
    position: relative;
    z-index: 1;
  }
  .header-main, .identity-row, .farmer-row, .total-row {
    align-items: center;
    display: flex;
    justify-content: space-between;
  }
  .header-main { gap: 12px; }
  .company-name { color: ${BRAND_COLORS.ink}; font-size: 21px; font-weight: 900; letter-spacing: .2px; }
  .document-title { color: ${BRAND_COLORS.primary}; font-size: 10px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; }
  .identity-row { color: ${BRAND_COLORS.ink}; font-size: 9px; font-weight: 700; gap: 10px; margin-top: 1px; }
  .proprietor { min-width: 0; }
  .phone { color: ${BRAND_COLORS.primary}; white-space: nowrap; }
  .phone-label { color: ${BRAND_COLORS.muted}; font-weight: 600; }
  .phone-number { font-size: 10px; font-weight: 800; }
  .tagline { color: ${BRAND_COLORS.primary}; font-size: 9px; font-weight: 800; letter-spacing: .3px; margin-top: 2px; text-transform: uppercase; }
  .business-details { color: ${BRAND_COLORS.muted}; font-size: 8px; font-weight: 500; margin-top: 1px; }
  .farmer-section {
    background: ${BRAND_COLORS.primarySoft};
    border: 1px solid ${BRAND_COLORS.border};
    border-radius: 5px;
    margin-bottom: 7px;
    padding: 6px 8px;
    position: relative;
    z-index: 1;
  }
  .farmer-left { flex: 1; min-width: 0; }
  .farmer-right { text-align: right; }
  .farmer-name { color: ${BRAND_COLORS.ink}; font-size: 13px; font-weight: 800; margin-bottom: 1px; }
  .farmer-details, .bill-date { color: ${BRAND_COLORS.muted}; font-size: 9px; font-weight: 500; }
  .bill-number { color: ${BRAND_COLORS.primary}; font-size: 11px; font-weight: 800; margin-bottom: 1px; }
  table { border: 1px solid ${BRAND_COLORS.border}; border-collapse: collapse; margin-bottom: 7px; position: relative; table-layout: fixed; width: 100%; z-index: 1; }
  thead { background: ${BRAND_COLORS.ink}; }
  th { color: #fff; font-size: 8px; font-weight: 700; letter-spacing: .3px; padding: 5px 4px; text-align: left; text-transform: uppercase; }
  td { background: #fff; border-bottom: 1px solid ${BRAND_COLORS.border}; color: ${BRAND_COLORS.ink}; font-size: 9.5px; overflow-wrap: anywhere; padding: 5px 4px; vertical-align: middle; }
  tbody tr:nth-child(even) td { background: ${BRAND_COLORS.primarySoft}; }
  .item-name { font-weight: 800; }
  .item-amount { color: ${BRAND_COLORS.primary}; font-weight: 800; white-space: nowrap; }
  .nowrap { white-space: nowrap; }
  .text-center { text-align: center; }
  .text-right { text-align: right; }
  .totals {
    background: ${BRAND_COLORS.surface};
    border: 1px solid ${BRAND_COLORS.border};
    border-radius: 5px;
    break-inside: avoid;
    margin-top: 7px;
    padding: 7px 8px;
    page-break-inside: avoid;
    position: relative;
    z-index: 1;
  }
  .total-row { font-size: 10px; margin-bottom: 2px; padding: 1px 0; }
  .total-label { color: ${BRAND_COLORS.muted}; font-weight: 600; }
  .total-value { color: ${BRAND_COLORS.ink}; font-weight: 700; }
  .charge-row { border-left: 3px solid ${BRAND_COLORS.primarySoftStrong}; padding-left: 16px; }
  .charge-label { color: ${BRAND_COLORS.muted}; font-size: 9.5px; font-weight: 500; }
  .charge-value, .payment-paid { color: ${BRAND_COLORS.primary}; font-weight: 700; }
  .deduction-value, .payment-due { color: #B91C1C; font-weight: 700; }
  .separator { background: ${BRAND_COLORS.border}; height: 1px; margin: 4px 0; }
  .grand-total { background: ${BRAND_COLORS.primarySoftStrong}; border-radius: 5px; border-top: 3px solid ${BRAND_COLORS.primary}; margin-top: 5px; padding: 6px; }
  .grand-total .total-label { color: ${BRAND_COLORS.ink}; font-size: 11px; font-weight: 900; letter-spacing: .6px; text-transform: uppercase; }
  .grand-total .total-value { color: ${BRAND_COLORS.primary}; font-size: 14px; font-weight: 900; }
  .notes { border-top: 1px solid ${BRAND_COLORS.border}; margin-top: 6px; padding-top: 6px; }
  .notes-title { color: ${BRAND_COLORS.muted}; font-size: 9px; font-weight: 600; margin-bottom: 2px; }
  .notes-text { color: ${BRAND_COLORS.ink}; font-size: 9px; font-style: italic; }
  .payment-details-section { background: ${BRAND_COLORS.primarySoft}; border: 1px solid ${BRAND_COLORS.border}; border-radius: 5px; margin-top: 7px; padding: 7px; position: relative; z-index: 1; }
  .payment-details-title { border-bottom: 2px solid ${BRAND_COLORS.primary}; color: ${BRAND_COLORS.ink}; font-size: 9px; font-weight: 800; margin-bottom: 4px; padding-bottom: 2px; text-transform: uppercase; }
  .payment-table { margin: 0; }
  .payment-table th { font-size: 7.5px; padding: 4px 3px; }
  .payment-table td { font-size: 8.5px; padding: 3px; }
  .payment-amount-cell { color: ${BRAND_COLORS.primary}; font-weight: 700; }
  .payment-notes-cell { color: ${BRAND_COLORS.muted}; font-size: 8px; font-style: italic; }
  .footer { background: ${BRAND_COLORS.surface}; border-top: 3px double ${BRAND_COLORS.border}; margin-top: auto; padding: 6px 0 3px; text-align: center; }
  .footer-text { color: ${BRAND_COLORS.primary}; font-size: 10px; font-weight: 700; letter-spacing: .4px; }
`;
