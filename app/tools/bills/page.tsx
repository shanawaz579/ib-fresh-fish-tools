'use client';

import { useState, useEffect } from 'react';
import { getCustomers } from '@/app/actions/stock';
import { getBillsByCustomer, deleteBill, getBillById, type Bill } from '@/app/actions/bills';
import type { Customer } from '@/app/actions/stock';
import { ProtectedRoute } from '@/components/ProtectedRoute';

export default function BillsPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedBillId, setExpandedBillId] = useState<number | null>(null);

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    const data = await getCustomers();
    setCustomers(data);
  };

  const handleCustomerSelect = async (customerId: number) => {
    setSelectedCustomerId(customerId);
    setLoading(true);
    setExpandedBillId(null);

    const customerBills = await getBillsByCustomer(customerId);
    setBills(customerBills);
    setLoading(false);
  };

  const handleDeleteBill = async (billId: number, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row expansion

    if (!confirm('Are you sure you want to delete this bill? This cannot be undone.')) {
      return;
    }

    const success = await deleteBill(billId);
    if (success) {
      // Refresh bills list
      setBills(prev => prev.filter(b => b.id !== billId));
      if (expandedBillId === billId) {
        setExpandedBillId(null);
      }
    } else {
      alert('Failed to delete bill');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-700';
      case 'partial': return 'bg-amber-100 text-amber-700';
      default: return 'bg-red-100 text-red-700';
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // Calculate totals for selected customer
  const totalBilled = bills.reduce((sum, bill) => sum + (bill.total || 0), 0);
  const totalReceived = bills.reduce((sum, bill) => sum + ((bill as any).amount_received || 0), 0);
  const totalPending = totalBilled - totalReceived;

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Bills</h1>
              <p className="text-sm text-gray-500">View bills by customer</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Customer List */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                <h2 className="font-semibold text-gray-700">Customers</h2>
              </div>
              <div className="max-h-[calc(100vh-250px)] overflow-y-auto">
                {customers.map((customer) => (
                  <button
                    key={customer.id}
                    onClick={() => handleCustomerSelect(customer.id)}
                    className={`w-full px-4 py-3 text-left border-b border-gray-100 hover:bg-blue-50 transition-colors ${
                      selectedCustomerId === customer.id ? 'bg-blue-100 border-l-4 border-l-blue-500' : ''
                    }`}
                  >
                    <div className="font-medium text-gray-800">{customer.name}</div>
                    {customer.phone && (
                      <div className="text-xs text-gray-500">{customer.phone}</div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Bills List */}
          <div className="lg:col-span-3">
            {!selectedCustomerId ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-gray-500">Select a customer to view their bills</p>
              </div>
            ) : loading ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                <p className="text-gray-500">Loading bills...</p>
              </div>
            ) : (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                    <div className="text-sm text-gray-500 mb-1">Total Billed</div>
                    <div className="text-2xl font-bold text-gray-800">₹{totalBilled.toLocaleString()}</div>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                    <div className="text-sm text-gray-500 mb-1">Received</div>
                    <div className="text-2xl font-bold text-green-600">₹{totalReceived.toLocaleString()}</div>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                    <div className="text-sm text-gray-500 mb-1">Pending</div>
                    <div className={`text-2xl font-bold ${totalPending > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      ₹{totalPending.toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Bills Table */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                    <h2 className="font-semibold text-gray-700">
                      Bills for {customers.find(c => c.id === selectedCustomerId)?.name}
                    </h2>
                    <span className="text-sm text-gray-500">{bills.length} bills</span>
                  </div>

                  {bills.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      No bills found for this customer
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {bills.map((bill) => (
                        <div key={bill.id} className="hover:bg-gray-50">
                          {/* Bill Row */}
                          <div
                            className="px-4 py-3 flex items-center justify-between cursor-pointer"
                            onClick={() => setExpandedBillId(expandedBillId === bill.id ? null : bill.id)}
                          >
                            <div className="flex items-center gap-4">
                              <div>
                                <div className="font-semibold text-blue-600">{bill.bill_number}</div>
                                <div className="text-sm text-gray-500">{formatDate(bill.bill_date)}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-6">
                              <div className="text-right">
                                <div className="font-semibold text-gray-800">₹{bill.total.toLocaleString()}</div>
                                <div className="text-xs text-gray-500">
                                  Received: ₹{((bill as any).amount_received || 0).toLocaleString()}
                                </div>
                              </div>
                              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(bill.payment_status)}`}>
                                {bill.payment_status}
                              </span>
                              <button
                                onClick={(e) => handleDeleteBill(bill.id, e)}
                                className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Delete bill"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                              <svg
                                className={`w-5 h-5 text-gray-400 transition-transform ${expandedBillId === bill.id ? 'rotate-180' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          </div>

                          {/* Expanded Details */}
                          {expandedBillId === bill.id && (
                            <div className="px-4 pb-4 bg-gray-50 border-t border-gray-100">
                              <div className="mt-3">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="text-gray-500 text-left">
                                      <th className="pb-2 font-medium">Item</th>
                                      <th className="pb-2 font-medium text-center">Qty</th>
                                      <th className="pb-2 font-medium text-center">Rate</th>
                                      <th className="pb-2 font-medium text-right">Amount</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {bill.items.map((item, idx) => (
                                      <tr key={idx} className="border-t border-gray-200">
                                        <td className="py-2 font-medium text-gray-800">{item.fish_variety_name}</td>
                                        <td className="py-2 text-center text-gray-600">
                                          {item.quantity_crates > 0 ? `${item.quantity_crates}cr ` : ''}
                                          {item.quantity_kg > 0 ? `${item.quantity_kg}kg` : ''}
                                        </td>
                                        <td className="py-2 text-center text-gray-600">₹{item.rate_per_kg}/kg</td>
                                        <td className="py-2 text-right font-medium text-gray-800">₹{item.amount.toLocaleString()}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>

                                <div className="mt-3 pt-3 border-t border-gray-200 flex justify-end">
                                  <div className="w-64 space-y-1 text-sm">
                                    <div className="flex justify-between">
                                      <span className="text-gray-500">Subtotal</span>
                                      <span>₹{bill.subtotal.toLocaleString()}</span>
                                    </div>
                                    {(bill as any).previous_balance > 0 && (
                                      <div className="flex justify-between">
                                        <span className="text-gray-500">Previous Balance</span>
                                        <span>₹{((bill as any).previous_balance || 0).toLocaleString()}</span>
                                      </div>
                                    )}
                                    <div className="flex justify-between font-semibold">
                                      <span>Grand Total</span>
                                      <span>₹{(bill.total + ((bill as any).previous_balance || 0)).toLocaleString()}</span>
                                    </div>
                                    {(bill as any).amount_received > 0 && (
                                      <div className="flex justify-between text-green-600">
                                        <span>Received</span>
                                        <span>-₹{((bill as any).amount_received || 0).toLocaleString()}</span>
                                      </div>
                                    )}
                                    <div className={`flex justify-between font-bold pt-1 border-t ${((bill as any).balance_due || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                      <span>Balance Due</span>
                                      <span>₹{((bill as any).balance_due || 0).toLocaleString()}</span>
                                    </div>
                                  </div>
                                </div>

                                {bill.notes && (
                                  <div className="mt-3 pt-3 border-t border-gray-200 text-sm text-gray-600">
                                    <span className="font-medium">Notes:</span> {bill.notes}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
