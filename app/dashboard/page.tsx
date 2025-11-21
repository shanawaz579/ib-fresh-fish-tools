'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/app/context/AuthContext';
import Link from 'next/link';

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <ProtectedRoute>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-800">Welcome to Fish Trading Dashboard</h1>
          <p className="text-gray-600 mt-2">Logged in as: <span className="font-semibold">{user?.email}</span></p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Sales Spreadsheet Card */}
          <Link href="/tools/sales-spreadsheet">
            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition cursor-pointer border-l-4 border-blue-500">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-gray-800">Sales Recording</h3>
                  <p className="text-gray-600 mt-2">Record daily fish sales with easy spreadsheet interface</p>
                </div>
                <div className="text-3xl">📊</div>
              </div>
              <div className="mt-4 text-blue-500 font-medium">Open →</div>
            </div>
          </Link>

          {/* Purchases Card */}
          <Link href="/tools/purchases">
            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition cursor-pointer border-l-4 border-green-500">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-gray-800">Purchases</h3>
                  <p className="text-gray-600 mt-2">Manage fish purchases from farmers</p>
                </div>
                <div className="text-3xl">📦</div>
              </div>
              <div className="mt-4 text-green-500 font-medium">Open →</div>
            </div>
          </Link>

          {/* Sales Records Card */}
          <Link href="/tools/sales">
            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition cursor-pointer border-l-4 border-purple-500">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-gray-800">Sales Records</h3>
                  <p className="text-gray-600 mt-2">View all sales transactions</p>
                </div>
                <div className="text-3xl">💰</div>
              </div>
              <div className="mt-4 text-purple-500 font-medium">Open →</div>
            </div>
          </Link>

          {/* Manage Farmers Card */}
          <Link href="/tools/manage/farmers">
            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition cursor-pointer border-l-4 border-yellow-500">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-gray-800">Manage Farmers</h3>
                  <p className="text-gray-600 mt-2">Add, edit, or remove farmer information</p>
                </div>
                <div className="text-3xl">👨‍🌾</div>
              </div>
              <div className="mt-4 text-yellow-500 font-medium">Open →</div>
            </div>
          </Link>

          {/* Manage Customers Card */}
          <Link href="/tools/manage/customers">
            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition cursor-pointer border-l-4 border-pink-500">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-gray-800">Manage Customers</h3>
                  <p className="text-gray-600 mt-2">Add, edit, or remove customer information</p>
                </div>
                <div className="text-3xl">🛍️</div>
              </div>
              <div className="mt-4 text-pink-500 font-medium">Open →</div>
            </div>
          </Link>

          {/* Manage Fish Varieties Card */}
          <Link href="/tools/manage/fish-varieties">
            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition cursor-pointer border-l-4 border-cyan-500">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-gray-800">Manage Fish Varieties</h3>
                  <p className="text-gray-600 mt-2">Add, edit, or remove fish variety information</p>
                </div>
                <div className="text-3xl">🐟</div>
              </div>
              <div className="mt-4 text-cyan-500 font-medium">Open →</div>
            </div>
          </Link>
        </div>

        <div className="mt-12 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-blue-900 mb-2">Quick Stats</h2>
          <p className="text-blue-800">Start by recording purchases and sales, managing your inventory, and keeping track of farmers and customers.</p>
        </div>
      </div>
    </ProtectedRoute>
  );
}
