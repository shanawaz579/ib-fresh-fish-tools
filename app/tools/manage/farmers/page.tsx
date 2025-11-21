'use client';

import { useState, useEffect } from 'react';
import CreatableSelect from '@/components/CreatableSelect';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { getFarmers, addFarmer, updateFarmer, deleteFarmer } from '@/app/actions/stock';
import type { Farmer } from '@/app/actions/stock';

interface FarmerFormData {
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  bank_account: string;
  bank_name: string;
  notes: string;
}

const initialFormData: FarmerFormData = {
  name: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  state: '',
  bank_account: '',
  bank_name: '',
  notes: '',
};

export default function FarmersPage() {
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<FarmerFormData>(initialFormData);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingData, setEditingData] = useState<FarmerFormData>(initialFormData);
  const [selectedFarmerId, setSelectedFarmerId] = useState<string>('');

  useEffect(() => {
    loadFarmers();
  }, []);

  const loadFarmers = async () => {
    setLoading(true);
    const data = await getFarmers();
    setFarmers(data);
    setLoading(false);
  };

  const handleFarmerSelect = (value: string, isNew: boolean) => {
    if (isNew) {
      // Create new entry
      setFormData({ ...initialFormData, name: value });
      setSelectedFarmerId('');
      setEditingId(null);
    } else {
      // Edit existing entry
      const farmerId = parseInt(value);
      const farmer = farmers.find(f => f.id === farmerId);
      if (farmer) {
        setSelectedFarmerId(value);
        setEditingId(farmerId);
        setEditingData({
          name: farmer.name || '',
          phone: farmer.phone || '',
          email: farmer.email || '',
          address: farmer.address || '',
          city: farmer.city || '',
          state: farmer.state || '',
          bank_account: farmer.bank_account || '',
          bank_name: farmer.bank_name || '',
          notes: farmer.notes || '',
        });
      }
    }
  };

  const handleAddFarmer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Please enter farmer name');
      return;
    }

    setSubmitting(true);
    const result = await addFarmer(
      formData.name,
      formData.phone,
      formData.email,
      formData.address,
      formData.city,
      formData.state,
      formData.bank_account,
      formData.bank_name,
      formData.notes
    );
    if (result) {
      setFormData(initialFormData);
      setSelectedFarmerId('');
      await loadFarmers();
      alert('Farmer added successfully!');
    } else {
      alert('Failed to add farmer. Name, phone, or email might already exist.');
    }
    setSubmitting(false);
  };

  const handleStartEdit = (farmer: Farmer) => {
    setEditingId(farmer.id);
    setEditingData({
      name: farmer.name || '',
      phone: farmer.phone || '',
      email: farmer.email || '',
      address: farmer.address || '',
      city: farmer.city || '',
      state: farmer.state || '',
      bank_account: farmer.bank_account || '',
      bank_name: farmer.bank_name || '',
      notes: farmer.notes || '',
    });
  };

  const handleSaveEdit = async (id: number) => {
    if (!editingData.name.trim()) {
      alert('Please enter farmer name');
      return;
    }

    setSubmitting(true);
    const result = await updateFarmer(
      id,
      editingData.name,
      editingData.phone,
      editingData.email,
      editingData.address,
      editingData.city,
      editingData.state,
      editingData.bank_account,
      editingData.bank_name,
      editingData.notes
    );
    if (result) {
      setEditingId(null);
      setSelectedFarmerId('');
      setFormData(initialFormData);
      await loadFarmers();
      alert('Farmer updated successfully!');
    } else {
      alert('Failed to update farmer. Name, phone, or email might already exist.');
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this farmer?')) {
      setSubmitting(true);
      const result = await deleteFarmer(id);
      if (result) {
        await loadFarmers();
        setEditingId(null);
        setSelectedFarmerId('');
        setFormData(initialFormData);
        alert('Farmer deleted successfully!');
      } else {
        alert('Failed to delete farmer');
      }
      setSubmitting(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setSelectedFarmerId('');
    setFormData(initialFormData);
    setEditingData(initialFormData);
  };

  return (
    <ProtectedRoute>
      <div className="p-8">
      <h1 className="text-3xl font-bold mb-6 text-primary">Manage Farmers</h1>

      {/* Add/Edit Farmer Form */}
      {!editingId && (
        <div className="bg-white p-6 rounded-lg shadow mb-8">
          <h2 className="text-xl font-semibold mb-4">Add New Farmer</h2>
          <form onSubmit={handleAddFarmer} className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-2">Select or Create Farmer</label>
              <CreatableSelect
                options={farmers}
                value={selectedFarmerId}
                onChange={handleFarmerSelect}
                placeholder="Search existing or type new name..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Farmer Name *</label>
              <input
                type="text"
                placeholder="Enter farmer name"
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
              <label className="block text-sm font-medium mb-2">Bank Account</label>
              <input
                type="text"
                placeholder="Enter bank account number"
                value={formData.bank_account}
                onChange={(e) => setFormData({ ...formData, bank_account: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Bank Name</label>
              <input
                type="text"
                placeholder="Enter bank name"
                value={formData.bank_name}
                onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
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
                {submitting ? 'Adding...' : 'Add Farmer'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Modal */}
      {editingId !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-xl font-semibold mb-4">Edit Farmer</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Farmer Name *</label>
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
                <label className="block text-sm font-medium mb-2">Bank Account</label>
                <input
                  type="text"
                  value={editingData.bank_account}
                  onChange={(e) => setEditingData({ ...editingData, bank_account: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Bank Name</label>
                <input
                  type="text"
                  value={editingData.bank_name}
                  onChange={(e) => setEditingData({ ...editingData, bank_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
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

      {/* Farmers List */}
      {!editingId && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="px-6 py-3 text-left font-semibold">Name</th>
                <th className="px-6 py-3 text-left font-semibold">Phone</th>
                <th className="px-6 py-3 text-left font-semibold">Email</th>
                <th className="px-6 py-3 text-left font-semibold">City</th>
                <th className="px-6 py-3 text-left font-semibold">Bank</th>
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
              ) : farmers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                    No farmers found
                  </td>
                </tr>
              ) : (
                farmers.map((farmer) => (
                  <tr key={farmer.id} className="border-b hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium">{farmer.name}</td>
                    <td className="px-6 py-4 text-sm">{farmer.phone || '-'}</td>
                    <td className="px-6 py-4 text-sm">{farmer.email || '-'}</td>
                    <td className="px-6 py-4 text-sm">{farmer.city || '-'}</td>
                    <td className="px-6 py-4 text-sm">{farmer.bank_name || '-'}</td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleStartEdit(farmer)}
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
    </ProtectedRoute>
  );
}
