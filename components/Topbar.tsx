"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/context/AuthContext";

// Fish icon for branding
function FishIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 12c.94-3.46 4.94-6 8.5-6 3.56 0 6.06 2.54 7 6-.94 3.46-3.44 6-7 6-3.56 0-7.56-2.54-8.5-6Z" />
      <path d="M18 12v.5" />
      <path d="M16 17.93a9.77 9.77 0 0 1 0-11.86" />
      <path d="M7 10.67C7 8 5.58 5.97 2.73 5.5c-1 1.5-1 5.5 0 7C5.58 12.03 7 10 7 10.67Z" />
    </svg>
  );
}

// Logout icon
function LogoutIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

export default function Topbar() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push('/auth/login');
  };

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '56px',
        padding: '0 20px',
        background: '#ffffff',
        borderBottom: '1px solid #e5e7eb',
      }}
    >
      {/* Logo & Brand */}
      <Link
        href="/dashboard"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          textDecoration: 'none',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '36px',
            height: '36px',
            background: '#3b82f6',
            borderRadius: '8px',
            color: 'white',
          }}
        >
          <FishIcon />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
          <span
            style={{
              fontSize: '15px',
              fontWeight: 700,
              color: '#111827',
              letterSpacing: '-0.01em',
            }}
          >
            IB Fresh Fish
          </span>
          <span
            style={{
              fontSize: '11px',
              color: '#6b7280',
              fontWeight: 500,
            }}
          >
            Trading Tools
          </span>
        </div>
      </Link>

      {/* User Section */}
      {user && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          <span
            style={{
              fontSize: '13px',
              color: '#374151',
              fontWeight: 500,
            }}
          >
            {user.email}
          </span>
          <button
            onClick={handleLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 500,
              color: '#dc2626',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#fee2e2';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#fef2f2';
            }}
          >
            <LogoutIcon />
            <span>Logout</span>
          </button>
        </div>
      )}
    </header>
  );
}
