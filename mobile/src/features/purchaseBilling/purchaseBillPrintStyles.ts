export const PURCHASE_BILL_PRINT_CSS = `
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
            margin-bottom: 7px;
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
          .item-list {
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            overflow: hidden;
            margin-bottom: 7px;
            position: relative;
            z-index: 1;
          }
          .item-row {
            padding: 7px 9px;
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
          .farmer-section {
            margin-bottom: 7px;
            padding: 8px;
            background: #f9fafb;
            border-radius: 6px;
            border: 1px solid #e5e7eb;
            position: relative;
            z-index: 1;
          }
          .farmer-row {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
          }
          .farmer-left {
            flex: 1;
          }
          .farmer-right {
            text-align: right;
            background: #fff;
            padding: 8px 12px;
            border-radius: 6px;
            border: 1px solid #e5e7eb;
          }
          .farmer-name {
            font-size: 16px;
            font-weight: 800;
            color: #111827;
            margin-bottom: 2px;
          }
          .farmer-details {
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
            margin-bottom: 7px;
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
            padding: 5px 3px;
            text-align: left;
            font-size: 10px;
            font-weight: 700;
            color: #ffffff;
            text-transform: uppercase;
            letter-spacing: 0.3px;
          }
          td {
            padding: 5px 3px;
            font-size: 12px;
            color: #111827;
            border-bottom: 1px solid #e5e7eb;
            background: #ffffff;
            overflow-wrap: anywhere;
          }
          tbody tr:nth-child(even) td {
            background: #f9fafb;
          }
          tbody tr:hover td {
            background: #f0f9ff;
          }
          .qty-subtext {
            font-size: 11px;
            color: #6b7280;
            margin-top: 2px;
            font-weight: 500;
          }
          .text-center {
            text-align: center;
          }
          .text-right {
            text-align: right;
          }
          .totals {
            margin-top: 7px;
            padding: 8px;
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
            margin-bottom: 3px;
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
            padding-left: 16px;
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
          .deduction-value {
            font-size: 12.5px;
            color: #DC2626;
            font-weight: 700;
          }
          .separator {
            height: 1px;
            background: linear-gradient(to right, #e5e7eb, #cbd5e1, #e5e7eb);
            margin: 6px 0;
          }
          .grand-total {
            margin-top: 5px;
            padding: 6px;
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
            margin-top: 7px;
            padding-top: 7px;
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
          .payment-details-section {
            margin-top: 7px;
            padding: 8px;
            background: #f8fafc;
            border-radius: 6px;
            border: 1px solid #e5e7eb;
            position: relative;
            z-index: 1;
          }
          .payment-details-title {
            font-size: 12px;
            font-weight: 700;
            color: #374151;
            margin-bottom: 6px;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            border-bottom: 2px solid #0ea5e9;
            padding-bottom: 3px;
          }
          .payment-table {
            width: 100%;
            border-collapse: collapse;
            margin: 0;
            background: #fff;
          }
          .payment-table thead {
            background: linear-gradient(to bottom, #0ea5e9, #0284c7);
          }
          .payment-table th {
            padding: 5px 4px;
            text-align: left;
            font-size: 10px;
            font-weight: 700;
            color: #ffffff;
            text-transform: uppercase;
            letter-spacing: 0.3px;
          }
          .payment-table td {
            padding: 4px;
            font-size: 11.5px;
            color: #111827;
            border-bottom: 1px solid #e5e7eb;
            background: #ffffff;
          }
          .payment-table tbody tr:nth-child(even) td {
            background: #f9fafb;
          }
          .payment-amount-cell {
            font-weight: 700;
            color: #059669;
          }
          .payment-notes-cell {
            font-size: 9px;
            color: #6b7280;
            font-style: italic;
          }
          .payment-space {
            margin-top: 15px;
            padding: 12px;
            border: 2px dashed #d1d5db;
            border-radius: 6px;
            background: #fafafa;
            min-height: 60px;
          }
          .payment-space-title {
            font-size: 10px;
            font-weight: 700;
            color: #374151;
            margin-bottom: 4px;
            text-transform: uppercase;
            letter-spacing: 0.3px;
          }
          .payment-space-subtitle {
            font-size: 9px;
            color: #6b7280;
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
`;
