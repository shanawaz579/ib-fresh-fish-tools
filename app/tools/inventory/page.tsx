'use client';

import { useEffect, useState } from 'react';
import { getInventoryData, type InventoryItem } from '@/app/actions/inventory';

export default function Inventory() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchInventory() {
      const data = await getInventoryData();
      setInventory(data);
      setLoading(false);
    }

    fetchInventory();
  }, []);

  if (loading) {
    return <div>Loading inventory...</div>;
  }

  return (
    <div className="container mx-auto p-8">
      <h2 className="text-2xl font-bold text-primary mb-4">Inventory</h2>
      <table className="w-full border-collapse border border-gray-300">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-300 px-4 py-2">Farmer</th>
            <th className="border border-gray-300 px-4 py-2">Fish Type</th>
            <th className="border border-gray-300 px-4 py-2">Crates</th>
            <th className="border border-gray-300 px-4 py-2">Loose Weight (kg)</th>
            <th className="border border-gray-300 px-4 py-2">Date</th>
          </tr>
        </thead>
        <tbody>
          {inventory.map((item) => (
            <tr key={item.id} className="hover:bg-gray-50">
              <td className="border border-gray-300 px-4 py-2">{item.farmer}</td>
              <td className="border border-gray-300 px-4 py-2">{item.fish_type}</td>
              <td className="border border-gray-300 px-4 py-2">{item.crates}</td>
              <td className="border border-gray-300 px-4 py-2">{item.loose_weight}</td>
              <td className="border border-gray-300 px-4 py-2">{new Date(item.date).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
