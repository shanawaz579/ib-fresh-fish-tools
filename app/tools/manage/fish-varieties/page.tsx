'use client';

import { useState, useEffect } from 'react';
import { getFishVarieties, addFishVariety, updateFishVariety, deleteFishVariety } from '@/app/actions/stock';
import type { FishVariety } from '@/app/actions/stock';

export default function FishVarietiesPage() {
  const [varieties, setVarieties] = useState<FishVariety[]>([]);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');

  useEffect(() => {
    loadVarieties();
  }, []);

  const loadVarieties = async () => {
    setLoading(true);
    const data = await getFishVarieties();
    setVarieties(data);
    setLoading(false);
  };

  const handleAddVariety = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      alert('Please enter fish variety name');
      return;
    }

    setSubmitting(true);
    const result = await addFishVariety(newName);
    if (result) {
      setNewName('');
      await loadVarieties();
    } else {
      alert('Failed to add fish variety. Name might already exist.');
    }
    setSubmitting(false);
  };

  const handleStartEdit = (variety: FishVariety) => {
    setEditingId(variety.id);
    setEditingName(variety.name);
  };

  const handleSaveEdit = async (id: number) => {
    if (!editingName.trim()) {
      alert('Please enter fish variety name');
      return;
    }

    setSubmitting(true);
    const result = await updateFishVariety(id, editingName);
    if (result) {
      setEditingId(null);
      await loadVarieties();
    } else {
      alert('Failed to update fish variety. Name might already exist.');
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this fish variety?')) {
      setSubmitting(true);
      const result = await deleteFishVariety(id);
      if (result) {
        await loadVarieties();
      } else {
        alert('Failed to delete fish variety');
      }
      setSubmitting(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName('');
  };

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6 text-primary">Manage Fish Varieties</h1>

      {/* Add Fish Variety Form */}
      <div className="bg-white p-6 rounded-lg shadow mb-8">
        <h2 className="text-xl font-semibold mb-4">Add New Fish Variety</h2>
        <form onSubmit={handleAddVariety} className="flex gap-3">
          <input
            type="text"
            placeholder="Enter fish variety name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
          >
            {submitting ? 'Adding...' : 'Add Variety'}
          </button>
        </form>
      </div>

      {/* Fish Varieties List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-100 border-b">
            <tr>
              <th className="px-6 py-3 text-left font-semibold">Fish Variety Name</th>
              <th className="px-6 py-3 text-left font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={2} className="px-6 py-4 text-center">
                  Loading...
                </td>
              </tr>
            ) : varieties.length === 0 ? (
              <tr>
                <td colSpan={2} className="px-6 py-4 text-center text-gray-500">
                  No fish varieties found
                </td>
              </tr>
            ) : (
              varieties.map((variety) => (
                <tr key={variety.id} className="border-b hover:bg-gray-50">
                  <td className="px-6 py-4">
                    {editingId === variety.id ? (
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="w-full px-3 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                      />
                    ) : (
                      variety.name
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      {editingId === variety.id ? (
                        <>
                          <button
                            onClick={() => handleSaveEdit(variety.id)}
                            disabled={submitting}
                            className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
                          >
                            Save
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="px-3 py-1 text-sm bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleStartEdit(variety)}
                            className="px-3 py-1 text-sm bg-blue-100 text-blue-600 rounded hover:bg-blue-200"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(variety.id)}
                            className="px-3 py-1 text-sm bg-red-100 text-red-600 rounded hover:bg-red-200"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
