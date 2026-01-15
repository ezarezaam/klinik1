import { Plus, BedDouble, Edit2, Trash2 } from 'lucide-react';
import { useState } from 'react';

export default function MasterKamar() {
  const [showAddModal, setShowAddModal] = useState(false);

  const data = [
    { id: 1, code: 'KM-101', name: 'Kamar 101', class: 'VIP', capacity: 2 },
    { id: 2, code: 'KM-202', name: 'Kamar 202', class: 'Kelas 1', capacity: 4 },
    { id: 3, code: 'KM-303', name: 'Kamar 303', class: 'Kelas 2', capacity: 6 },
  ];

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Master Kamar</h1>
          <p className="text-gray-600 mt-1">Kelola data kamar klinik</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-lg hover:bg-emerald-700 transition-colors shadow-lg"
        >
          <Plus className="w-5 h-5" />
          <span className="font-medium">Tambah Kamar</span>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Kode</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Nama Kamar</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Kelas</th>
                <th className="text-right py-4 px-6 text-sm font-semibold text-gray-700">Kapasitas</th>
                <th className="text-right py-4 px-6 text-sm font-semibold text-gray-700">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-4 px-6 text-sm text-gray-600">{row.code}</td>
                  <td className="py-4 px-6 text-sm font-medium text-gray-800 flex items-center gap-2">
                    <span className="w-8 h-8 bg-emerald-100 rounded-lg inline-flex items-center justify-center">
                      <BedDouble className="w-4 h-4 text-emerald-600" />
                    </span>
                    {row.name}
                  </td>
                  <td className="py-4 px-6 text-sm text-gray-600">{row.class}</td>
                  <td className="py-4 px-6 text-right text-sm font-semibold text-gray-800">{row.capacity}</td>
                  <td className="py-4 px-6 text-right">
                    <div className="flex justify-end gap-2">
                      <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                        <Edit2 className="w-4 h-4 text-gray-600" />
                      </button>
                      <button className="p-2 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-800">Tambah Kamar</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Kode</label>
                <input type="text" placeholder="KM-XXX" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nama Kamar</label>
                <input type="text" placeholder="Kamar 101" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Kelas</label>
                  <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none">
                    <option>VIP</option>
                    <option>Kelas 1</option>
                    <option>Kelas 2</option>
                    <option>Kelas 3</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Kapasitas</label>
                  <input type="number" placeholder="0" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" />
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button onClick={() => setShowAddModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-gray-700">Batal</button>
              <button className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium">Simpan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
