'use client';

import { useState, useEffect } from 'react';
import CreatableSelect from '@/components/CreatableSelect';
import { getCustomers, addCustomer, updateCustomer, deleteCustomer } from '@/app/actions/stock';
import type { Customer } from '@/app/actions/stock';

interface CustomerFormData {
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  contact_person: string;
  business_type: string;
  notes: string;
}

const initialFormData: CustomerFormData = {
  name: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  state: '',
  contact_person: '',
  business_type: '',
  notes: '',
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<CustomerFormData>(initialFormData);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingData, setEditingData] = useState<CustomerFormData>(initialFormData);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    setLoading(true);
    const data = await getCustomers();
    setCustomers(data);
    setLoading(false);
  };

  const handleCustomerSelect = (value: string, isNew: boolean) => {
    if (isNew) {
      // Create new entry
      setFormData({ ...initialFormData, name: value });
      setSelectedCustomerId('');
      setEditingId(null);
    } else {
      // Edit existing entry
      const customerId = parseInt(value);
      const customer = customers.find(c => c.id === customerId);
      if (customer) {
        setSelectedCustomerId(value);
        setEditingId(customerId);
        setEditingData({
          name: customer.name || '',
          phone: customer.phone || '',
          email: customer.email || '',
          address: customer.address || '',
          city: customer.city || '',
          state: customer.state || '',
          contact_person: customer.contact_person || '',
          business_type: customer.business_type || '',
          notes: customer.notes || '',
        });
      }
    }
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Please enter customer name');
      return;
    }

    setSubmitting(true);
    const result = await addCustomer(
      formData.name,
      formData.phone,
      formData.email,
      formData.address,
      formData.city,
      formData.state,
      formData.contact_person,
      formData.business_type,
      formData.notes
    );
    if (result) {
      setFormData(initialFormData);
      setSelectedCustomerId('');
      await loadCustomers();
      alert('Customer added successfully!');
    } else {
      alert('Failed to add customer. Name, phone, or email might already exist.');
    }
    setSubmitting(false);
  };

  const handleStartEdit = (customer: Customer) => {
    setEditingId(customer.id);
    setEditingData({
      name: customer.name || '',
      phone: customer.phone || '',
      email: customer.email || '',
      address: customer.address || '',
      city: customer.city || '',
      state: customer.state || '',
      contact_person: customer.contact_person || '',
      business_type: customer.business_type || '',
      notes: customer.notes || '',
    });
  };

  const handleSaveEdit = async (id: number) => {
    if (!editingData.name.trim()) {
      alert('Please enter customer name');
      return;
    }

    setSubmitting(true);
    const result = await updateCustomer(
      id,
      editingData.name,
      editingData.phone,
      editingData.email,
      editingData.address,
      editingData.city,
      editingData.state,
      editingData.contact_person,
      editingData.business_type,
      editingData.notes
    );
    if (result) {
      setEditingId(null);
      setSelectedCustomerId('');
      setFormData(initialFormData);
      await loadCustomers();
      alert('Customer updated successfully!');
    } else {
      alert('Failed to update customer. Name, phone, or email might already exist.');
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this customer?')) {
      setSubmitting(true);
      const result = await deleteCustomer(id);
      if (result) {
        await loadCustomers();
        setEditingId(null);
        setSelectedCustomerId('');
        setFormData(initialFormData);
        alert('Customer deleted successfully!');
      } else {
        alert('Failed to delete customer');
      }
      setSubmitting(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setSelectedCustomerId('');
    setFormData(initialFormData);
    setEditingData(initialFormData);
  };

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6 text-primary">Manage Customers</h1>

      {/* Add/Edit Customer Form */}
      {!editingId && (
        <div className="bg-white p-6 rounded-lg shadow mb-8">
          <h2 className="text-xl font-semibold mb-4">Add New Customer</h2>
          <form onSubmit={handleAddCustomer} className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-2">Select or Create Customer</label>
              <CreatableSelect
                options={customers}
                value={selectedCustomerId}
                onChange={handleCustomerSelect}
                placeholder="Search existing or type new name..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Customer Name *</label>
              <input
                type="text"
                placeholder="Enter customer name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Phone</label>
              <input
                type="tel"
                placeholder="Enter phone number"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Email</label>
              <input
                type="email"
                placeholder="Enter email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Contact Person</label>
              <input
                type="text"
                placeholder="Enter contact person name"
                value={formData.contact_person}
                onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Address</label>
              <input
                type="text"
                placeholder="Enter address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">City</label>
              <input
                type="text"
                placeholder="Enter city"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">State</label>
              <input
                type="text"
                placeholder="Enter state"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Business Type</label>
              <select
                value={formData.business_type}
                onChange={(e) => setFormData({ ...formData, business_type: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select business type</option>
                <option value="Restaurant">Restaurant</option>
                <option value="Hotel/Restaurant">Hotel/Restaurant</option>
                <option value="Wholesale Market">Wholesale Market</option>
                <option value="Retail Store">Retail Store</option>
                <option value="Supermarket">Supermarket</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-2">Notes</label>
              <textarea
                placeholder="Enter any additional notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
              />
            </div>
            <div className="col-span-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
              >
                {submitting ? 'Adding...' : 'Add Customer'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Modal */}
      {editingId !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-xl font-semibold mb-4">Edit Customer</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Customer Name *</label>
                <input
                  type="text"
                  value={editingData.name}
                  onChange={(e) => setEditingData({ ...editingData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Phone</label>
                <input
                  type="tel"
                  value={editingData.phone}
                  onChange={(e) => setEditingData({ ...editingData, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Email</label>
                <input
                  type="email"
                  value={editingData.email}
                  onChange={(e) => setEditingData({ ...editingData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Contact Person</label>
                <input
                  type="text"
                  value={editingData.contact_person}
                  onChange={(e) => setEditingData({ ...editingData, contact_person: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Address</label>
                <input
                  type="text"
                  value={editingData.address}
                  onChange={(e) => setEditingData({ ...editingData, address: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">City</label>
                <input
                  type="text"
                  value={editingData.city}
                  onChange={(e) => setEditingData({ ...editingData, city: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">State</label>
                <input
                  type="text"
                  value={editingData.state}
                  onChange={(e) => setEditingData({ ...editingData, state: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Business Type</label>
                <select
                  value={editingData.business_type}
                  onChange={(e) => setEditingData({ ...editingData, business_type: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select business type</option>
                  <option value="Restaurant">Restaurant</option>
                  <option value="Hotel/Restaurant">Hotel/Restaurant</option>
                  <option value="Wholesale Market">Wholesale Market</option>
                  <option value="Retail Store">Retail Store</option>
                  <option value="Supermarket">Supermarket</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-2">Notes</label>
                <textarea
                  value={editingData.notes}
                  onChange={(e) => setEditingData({ ...editingData, notes: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => handleSaveEdit(editingId)}
                disabled={submitting}
                className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
              >
                {submitting ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => handleDelete(editingId)}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                Delete
              </button>
              <button
                onClick={handleCancelEdit}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customers List */}
      {!editingId && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="px-6 py-3 text-left font-semibold">Name</th>
                <th className="px-6 py-3 text-left font-semibold">Phone</th>
                <th className="px-6 py-3 text-left font-semibold">Email</th>
                <th className="px-6 py-3 text-left font-semibold">City</th>
                <th className="px-6 py-3 text-left font-semibold">Business Type</th>
                <th className="px-6 py-3 text-left font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center">
                    Loading...
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                    No customers found
                  </td>
                </tr>
              ) : (
                customers.map((customer) => (
                  <tr key={customer.id} className="border-b hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium">{customer.name}</td>
                    <td className="px-6 py-4 text-sm">{customer.phone || '-'}</td>
                    <td className="px-6 py-4 text-sm">{customer.email || '-'}</td>
                    <td className="px-6 py-4 text-sm">{customer.city || '-'}</td>
                    <td className="px-6 py-4 text-sm">{customer.business_type || '-'}</td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleStartEdit(customer)}
                        className="px-3 py-1 text-sm bg-blue-100 text-blue-600 rounded hover:bg-blue-200"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
