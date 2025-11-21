"use client";

import Link from "next/link";
import { useState } from "react";

export default function Sidebar() {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <aside className={`hidden lg:flex transition-all duration-300 flex-shrink-0 flex-col gap-6 bg-white shadow-md dark:bg-gray-800 ${isExpanded ? 'w-72 p-8' : 'w-20 p-4'}`}>
      {/* Toggle Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex justify-center items-center p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition"
        title={isExpanded ? "Collapse" : "Expand"}
      >
        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" className={`transition-transform ${!isExpanded ? 'rotate-180' : ''}`}>
          <path strokeWidth="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <div className={`mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 ${!isExpanded && 'hidden'}`}>Navigation</div>
      <nav className="flex flex-col gap-2">
        <Link className="rounded px-4 py-2 flex items-center text-base font-medium text-gray-700 hover:bg-primary/10 hover:text-primary transition dark:text-gray-200 dark:hover:bg-primary/20" href="/dashboard">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="mr-2 flex-shrink-0">
            <rect x="3" y="3" width="7" height="7" rx="2" strokeWidth="2" />
            <rect x="14" y="3" width="7" height="7" rx="2" strokeWidth="2" />
            <rect x="14" y="14" width="7" height="7" rx="2" strokeWidth="2" />
            <rect x="3" y="14" width="7" height="7" rx="2" strokeWidth="2" />
          </svg>
          <span className={isExpanded ? '' : 'hidden'}>Dashboard</span>
        </Link>
        <Link className="rounded px-4 py-2 flex items-center text-base font-medium text-gray-700 hover:bg-primary/10 hover:text-primary transition dark:text-gray-200 dark:hover:bg-primary/20" href="/orders">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="mr-2 flex-shrink-0">
            <path strokeWidth="2" d="M4 7h16M4 12h16M4 17h16" />
          </svg>
          <span className={isExpanded ? '' : 'hidden'}>Orders</span>
        </Link>
        <Link className="rounded px-4 py-2 flex items-center text-base font-medium text-gray-700 hover:bg-primary/10 hover:text-primary transition dark:text-gray-200 dark:hover:bg-primary/20" href="/logistics">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="mr-2 flex-shrink-0">
            <path strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M13 5v6h6" />
          </svg>
          <span className={isExpanded ? '' : 'hidden'}>Logistics</span>
        </Link>
        <Link className="rounded px-4 py-2 flex items-center text-base font-medium text-gray-700 hover:bg-primary/10 hover:text-primary transition dark:text-gray-200 dark:hover:bg-primary/20" href="/inventory">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="mr-2 flex-shrink-0">
            <rect x="4" y="4" width="16" height="16" rx="2" strokeWidth="2" />
            <path strokeWidth="2" d="M4 9h16" />
          </svg>
          <span className={isExpanded ? '' : 'hidden'}>Inventory</span>
        </Link>
      </nav>

      <div className={`mt-8 text-xs font-semibold uppercase tracking-wide text-gray-500 ${!isExpanded && 'hidden'}`}>Tools</div>
      <nav className="flex flex-col gap-2">
        <Link className="rounded px-4 py-2 flex items-center text-base font-medium text-gray-700 hover:bg-primary/10 hover:text-primary transition dark:text-gray-200 dark:hover:bg-primary/20" href="/tools/purchases">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="mr-2 flex-shrink-0">
            <path strokeWidth="2" d="M12 8v8m0 0l-3-3m3 3l3-3" />
          </svg>
          <span className={isExpanded ? '' : 'hidden'}>Purchases</span>
        </Link>
        <Link className="rounded px-4 py-2 flex items-center text-base font-medium text-gray-700 hover:bg-primary/10 hover:text-primary transition dark:text-gray-200 dark:hover:bg-primary/20" href="/tools/sales">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="mr-2 flex-shrink-0">
            <circle cx="6" cy="6" r="3" strokeWidth="2" />
            <circle cx="18" cy="18" r="3" strokeWidth="2" />
            <path strokeWidth="2" d="M6 9v6a6 6 0 006 6" />
          </svg>
          <span className={isExpanded ? '' : 'hidden'}>Sales</span>
        </Link>
        <Link className="rounded px-4 py-2 flex items-center text-base font-medium text-gray-700 hover:bg-primary/10 hover:text-primary transition dark:text-gray-200 dark:hover:bg-primary/20" href="/tools/sales-spreadsheet">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="mr-2 flex-shrink-0">
            <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="2" />
            <path strokeWidth="2" d="M3 9h18M9 3v18" />
          </svg>
          <span className={isExpanded ? '' : 'hidden'}>Sales Spreadsheet</span>
        </Link>
        <Link className="rounded px-4 py-2 flex items-center text-base font-medium text-gray-700 hover:bg-primary/10 hover:text-primary transition dark:text-gray-200 dark:hover:bg-primary/20" href="/tools/price-manager">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="mr-2 flex-shrink-0">
            <path strokeWidth="2" d="M12 8v8m0 0l-3-3m3 3l3-3" />
          </svg>
          <span className={isExpanded ? '' : 'hidden'}>Price Manager</span>
        </Link>
        <Link className="rounded px-4 py-2 flex items-center text-base font-medium text-gray-700 hover:bg-primary/10 hover:text-primary transition dark:text-gray-200 dark:hover:bg-primary/20" href="/tools/route-planner">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="mr-2 flex-shrink-0">
            <circle cx="6" cy="6" r="3" strokeWidth="2" />
            <circle cx="18" cy="18" r="3" strokeWidth="2" />
            <path strokeWidth="2" d="M6 9v6a6 6 0 006 6" />
          </svg>
          <span className={isExpanded ? '' : 'hidden'}>Route Planner</span>
        </Link>
      </nav>

      <div className={`mt-8 text-xs font-semibold uppercase tracking-wide text-gray-500 ${!isExpanded && 'hidden'}`}>Management</div>
      <nav className="flex flex-col gap-2">
        <Link className="rounded px-4 py-2 flex items-center text-base font-medium text-gray-700 hover:bg-primary/10 hover:text-primary transition dark:text-gray-200 dark:hover:bg-primary/20" href="/tools/manage/farmers">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="mr-2 flex-shrink-0">
            <path strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M9 13H3v7a2 2 0 002 2h14a2 2 0 002-2v-7h-6" />
          </svg>
          <span className={isExpanded ? '' : 'hidden'}>Farmers</span>
        </Link>
        <Link className="rounded px-4 py-2 flex items-center text-base font-medium text-gray-700 hover:bg-primary/10 hover:text-primary transition dark:text-gray-200 dark:hover:bg-primary/20" href="/tools/manage/customers">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="mr-2 flex-shrink-0">
            <circle cx="12" cy="8" r="4" strokeWidth="2" />
            <path strokeWidth="2" d="M4 20c0-2.686 2.686-4 8-4s8 1.314 8 4" />
          </svg>
          <span className={isExpanded ? '' : 'hidden'}>Customers</span>
        </Link>
        <Link className="rounded px-4 py-2 flex items-center text-base font-medium text-gray-700 hover:bg-primary/10 hover:text-primary transition dark:text-gray-200 dark:hover:bg-primary/20" href="/tools/manage/fish-varieties">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="mr-2 flex-shrink-0">
            <path strokeWidth="2" d="M12 8v8m-4-4h8" />
          </svg>
          <span className={isExpanded ? '' : 'hidden'}>Fish Varieties</span>
        </Link>
      </nav>

      <div className={`mt-8 text-xs font-semibold uppercase tracking-wide text-gray-500 ${!isExpanded && 'hidden'}`}>Admin</div>
      <nav className="flex flex-col gap-2">
        <Link className="rounded px-4 py-2 flex items-center text-base font-medium text-gray-700 hover:bg-primary/10 hover:text-primary transition dark:text-gray-200 dark:hover:bg-primary/20" href="/admin/users">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="mr-2 flex-shrink-0">
            <circle cx="12" cy="8" r="4" strokeWidth="2" />
            <path strokeWidth="2" d="M4 20c0-2.686 2.686-4 8-4s8 1.314 8 4" />
            <path strokeWidth="2" d="M20 8l2 2m0 0l-2 2m2-2l-2-2m2 2l2 2" />
          </svg>
          <span className={isExpanded ? '' : 'hidden'}>Manage Users</span>
        </Link>
      </nav>
    </aside>
  );
}
