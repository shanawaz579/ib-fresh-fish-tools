'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/app/context/AuthContext';
import Link from 'next/link';

// Icon Components
function SpreadsheetIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <line x1="9" y1="3" x2="9" y2="21" />
    </svg>
  );
}

function PurchaseIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

function SalesIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

function FarmerIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18" />
      <path d="M5 21V7l8-4v18" />
      <path d="M19 21V11l-6-4" />
      <path d="M9 9v.01" />
      <path d="M9 12v.01" />
      <path d="M9 15v.01" />
      <path d="M9 18v.01" />
    </svg>
  );
}

function CustomerIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function FishIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 12c.94-3.46 4.94-6 8.5-6 3.56 0 6.06 2.54 7 6-.94 3.46-3.44 6-7 6-3.56 0-7.56-2.54-8.5-6Z" />
      <path d="M18 12v.5" />
      <path d="M16 17.93a9.77 9.77 0 0 1 0-11.86" />
      <path d="M7 10.67C7 8 5.58 5.97 2.73 5.5c-1 1.5-1 5.5 0 7C5.58 12.03 7 10 7 10.67Z" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

type DashboardCard = {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  color: 'primary' | 'secondary' | 'purple' | 'amber' | 'pink' | 'cyan';
};

const cards: DashboardCard[] = [
  {
    title: 'Sales Recording',
    description: 'Record daily fish sales with easy spreadsheet interface',
    href: '/tools/sales-spreadsheet',
    icon: <SpreadsheetIcon />,
    color: 'primary',
  },
  {
    title: 'Purchases',
    description: 'Manage fish purchases from farmers',
    href: '/tools/purchases',
    icon: <PurchaseIcon />,
    color: 'secondary',
  },
  {
    title: 'Sales Records',
    description: 'View all sales transactions',
    href: '/tools/sales',
    icon: <SalesIcon />,
    color: 'purple',
  },
  {
    title: 'Manage Farmers',
    description: 'Add, edit, or remove farmer information',
    href: '/tools/manage/farmers',
    icon: <FarmerIcon />,
    color: 'amber',
  },
  {
    title: 'Manage Customers',
    description: 'Add, edit, or remove customer information',
    href: '/tools/manage/customers',
    icon: <CustomerIcon />,
    color: 'pink',
  },
  {
    title: 'Fish Varieties',
    description: 'Add, edit, or remove fish variety information',
    href: '/tools/manage/fish-varieties',
    icon: <FishIcon />,
    color: 'cyan',
  },
];

const colorMap = {
  primary: {
    bg: 'var(--primary-light)',
    border: 'var(--primary)',
    text: 'var(--primary)',
    iconBg: 'var(--primary)',
  },
  secondary: {
    bg: 'var(--secondary-light)',
    border: 'var(--secondary)',
    text: 'var(--secondary)',
    iconBg: 'var(--secondary)',
  },
  purple: {
    bg: '#f3e8ff',
    border: '#9333ea',
    text: '#9333ea',
    iconBg: '#9333ea',
  },
  amber: {
    bg: '#fef3c7',
    border: '#f59e0b',
    text: '#d97706',
    iconBg: '#f59e0b',
  },
  pink: {
    bg: '#fce7f3',
    border: '#ec4899',
    text: '#ec4899',
    iconBg: '#ec4899',
  },
  cyan: {
    bg: '#cffafe',
    border: '#06b6d4',
    text: '#0891b2',
    iconBg: '#06b6d4',
  },
};

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <ProtectedRoute>
      <div className="dashboard-page">
        {/* Header Section */}
        <div className="dashboard-header">
          <div className="dashboard-header-content">
            <h1 className="dashboard-title">Dashboard</h1>
            <p className="dashboard-subtitle">
              Welcome back, <span className="dashboard-user">{user?.email?.split('@')[0]}</span>
            </p>
          </div>
          <div className="dashboard-date">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </div>
        </div>

        {/* Quick Actions Grid */}
        <div className="dashboard-section">
          <h2 className="dashboard-section-title">Quick Actions</h2>
          <div className="dashboard-grid">
            {cards.map((card) => {
              const colors = colorMap[card.color];
              return (
                <Link key={card.href} href={card.href} className="dashboard-card-link">
                  <div
                    className="dashboard-card"
                    style={{
                      '--card-accent': colors.border,
                      '--card-bg-accent': colors.bg,
                      '--card-icon-bg': colors.iconBg,
                      '--card-text-accent': colors.text,
                    } as React.CSSProperties}
                  >
                    <div className="dashboard-card-icon">
                      {card.icon}
                    </div>
                    <div className="dashboard-card-content">
                      <h3 className="dashboard-card-title">{card.title}</h3>
                      <p className="dashboard-card-description">{card.description}</p>
                    </div>
                    <div className="dashboard-card-action">
                      <span>Open</span>
                      <ArrowRightIcon />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Info Banner */}
        <div className="dashboard-info">
          <div className="dashboard-info-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </div>
          <div className="dashboard-info-content">
            <h3 className="dashboard-info-title">Getting Started</h3>
            <p className="dashboard-info-text">
              Start by recording purchases from farmers, then use the Sales Spreadsheet to track daily sales.
              Manage your farmers, customers, and fish varieties in the Master Data section.
            </p>
          </div>
        </div>

        <style jsx>{`
          .dashboard-page {
            padding: 1.5rem;
            max-width: 1400px;
            margin: 0 auto;
          }

          .dashboard-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 2rem;
            padding-bottom: 1.5rem;
            border-bottom: 1px solid var(--card-border);
          }

          .dashboard-title {
            font-size: 1.875rem;
            font-weight: 700;
            color: var(--foreground);
            margin: 0 0 0.25rem 0;
            letter-spacing: -0.025em;
          }

          .dashboard-subtitle {
            font-size: 0.9375rem;
            color: var(--muted);
            margin: 0;
          }

          .dashboard-user {
            font-weight: 600;
            color: var(--foreground);
          }

          .dashboard-date {
            font-size: 0.875rem;
            color: var(--muted);
            padding: 0.5rem 1rem;
            background: var(--card-bg);
            border: 1px solid var(--card-border);
            border-radius: var(--radius-md);
          }

          .dashboard-section {
            margin-bottom: 2rem;
          }

          .dashboard-section-title {
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--muted);
            margin: 0 0 1rem 0;
          }

          .dashboard-grid {
            display: grid;
            grid-template-columns: repeat(1, 1fr);
            gap: 1rem;
          }

          @media (min-width: 640px) {
            .dashboard-grid {
              grid-template-columns: repeat(2, 1fr);
            }
          }

          @media (min-width: 1024px) {
            .dashboard-grid {
              grid-template-columns: repeat(3, 1fr);
            }
          }

          .dashboard-card-link {
            text-decoration: none;
          }

          .dashboard-card {
            display: flex;
            flex-direction: column;
            gap: 1rem;
            padding: 1.25rem;
            background: var(--card-bg);
            border: 1px solid var(--card-border);
            border-radius: var(--radius-lg);
            box-shadow: var(--card-shadow);
            transition: all var(--transition-normal);
            position: relative;
            overflow: hidden;
          }

          .dashboard-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 4px;
            height: 100%;
            background: var(--card-accent);
          }

          .dashboard-card:hover {
            box-shadow: var(--card-shadow-hover);
            transform: translateY(-2px);
            border-color: var(--card-accent);
          }

          .dashboard-card-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 48px;
            height: 48px;
            background: var(--card-icon-bg);
            color: white;
            border-radius: var(--radius-md);
          }

          .dashboard-card-content {
            flex: 1;
          }

          .dashboard-card-title {
            font-size: 1rem;
            font-weight: 600;
            color: var(--foreground);
            margin: 0 0 0.25rem 0;
          }

          .dashboard-card-description {
            font-size: 0.8125rem;
            color: var(--muted);
            margin: 0;
            line-height: 1.5;
          }

          .dashboard-card-action {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            font-size: 0.8125rem;
            font-weight: 600;
            color: var(--card-text-accent);
            padding-top: 0.75rem;
            border-top: 1px solid var(--card-border);
          }

          .dashboard-card:hover .dashboard-card-action {
            gap: 0.75rem;
          }

          .dashboard-info {
            display: flex;
            gap: 1rem;
            padding: 1.25rem;
            background: var(--primary-light);
            border: 1px solid var(--primary);
            border-radius: var(--radius-lg);
          }

          .dashboard-info-icon {
            display: flex;
            align-items: flex-start;
            color: var(--primary);
            flex-shrink: 0;
          }

          .dashboard-info-content {
            flex: 1;
          }

          .dashboard-info-title {
            font-size: 0.9375rem;
            font-weight: 600;
            color: var(--primary-dark);
            margin: 0 0 0.25rem 0;
          }

          .dashboard-info-text {
            font-size: 0.8125rem;
            color: var(--primary-dark);
            margin: 0;
            line-height: 1.6;
            opacity: 0.9;
          }

          @media (max-width: 640px) {
            .dashboard-header {
              flex-direction: column;
              gap: 1rem;
            }

            .dashboard-date {
              align-self: flex-start;
            }
          }
        `}</style>
      </div>
    </ProtectedRoute>
  );
}
