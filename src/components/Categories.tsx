import { Plus, Edit2, Trash2, Tag } from 'lucide-react';
import { useState } from 'react';

export default function Categories() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [categoryType, setCategoryType] = useState<'income' | 'expense'>('income');

  const incomeCategories = [
    { id: 1, name: 'SPP Santri', count: 45 },
    { id: 2, name: 'Sumbangan', count: 23 },
    { id: 3, name: 'Donatur', count: 18 },
    { id: 4, name: 'Usaha Pesantren', count: 12 },
    { id: 5, name: 'Lain-lain', count: 8 },
  ];

  const expenseCategories = [
    { id: 1, name: 'Gaji Ustadz', count: 34 },
    { id: 2, name: 'Listrik', count: 28 },
    { id: 3, name: 'Air', count: 28 },
    { id: 4, name: 'Makanan', count: 56 },
    { id: 5, name: 'Operasional', count: 41 },
    { id: 6, name: 'Pemeliharaan', count: 19 },
    { id: 7, name: 'Lain-lain', count: 15 },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Kategori</h1>
        <p className="text-gray-600 mt-1">Kelola kategori pemasukan dan pengeluaran</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-800">Kategori Pemasukan</h2>
            <button
              onClick={() => {
                setCategoryType('income');
                setShowAddModal(true);
              }}
              className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="font-medium">Tambah</span>
            </button>
          </div>

          <div className="space-y-3">
            {incomeCategories.map((category) => (
              <div
                key={category.id}
                className="flex items-center justify-between p-4 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-200 rounded-lg flex items-center justify-center">
                    <Tag className="w-5 h-5 text-emerald-700" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">{category.name}</p>
                    <p className="text-sm text-gray-600">{category.count} transaksi</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="p-2 hover:bg-emerald-200 rounded-lg transition-colors">
                    <Edit2 className="w-4 h-4 text-gray-600" />
                  </button>
                  <button className="p-2 hover:bg-red-100 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-800">Kategori Pengeluaran</h2>
            <button
              onClick={() => {
                setCategoryType('expense');
                setShowAddModal(true);
              }}
              className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="font-medium">Tambah</span>
            </button>
          </div>

          <div className="space-y-3">
            {expenseCategories.map((category) => (
              <div
                key={category.id}
                className="flex items-center justify-between p-4 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-200 rounded-lg flex items-center justify-center">
                    <Tag className="w-5 h-5 text-red-700" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">{category.name}</p>
                    <p className="text-sm text-gray-600">{category.count} transaksi</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="p-2 hover:bg-red-200 rounded-lg transition-colors">
                    <Edit2 className="w-4 h-4 text-gray-600" />
                  </button>
                  <button className="p-2 hover:bg-red-200 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-800">
                Tambah Kategori {categoryType === 'income' ? 'Pemasukan' : 'Pengeluaran'}
              </h2>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nama Kategori
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Transportasi"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Deskripsi (Opsional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Tambahkan deskripsi kategori..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none"
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-gray-700"
              >
                Batal
              </button>
              <button className={`flex-1 px-4 py-2 text-white rounded-lg transition-colors font-medium ${
                categoryType === 'income'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-red-600 hover:bg-red-700'
              }`}>
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
