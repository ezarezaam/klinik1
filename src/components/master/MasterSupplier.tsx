import { Plus, Truck, Edit2, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

export default function MasterSupplier() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [rows, setRows] = useState<{ id: string | number; name: string; phone?: string; address?: string }[]>([]);
  const [addName, setAddName] = useState<string>('');
  const [addPhone, setAddPhone] = useState<string>('');
  const [addEmail, setAddEmail] = useState<string>('');
  const [addAddress, setAddAddress] = useState<string>('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editId, setEditId] = useState<string | number | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editPhone, setEditPhone] = useState<string>('');
  const [editEmail, setEditEmail] = useState<string>('');
  const [editAddress, setEditAddress] = useState<string>('');
  useEffect(() => {
    let active = true;
    const fetchSuppliers = async () => {
      if (!supabase) return;
      const { data } = await supabase.from('suppliers').select('id,name,phone,address').order('name', { ascending: true });
      if (!data || !active) return;
      setRows((data as { id: string; name: string; phone?: string | null; address?: string | null }[]).map((s) => ({
        id: s.id,
        name: s.name,
        phone: s.phone || undefined,
        address: s.address || undefined,
      })));
    };
    fetchSuppliers();
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!supabase) return;
    const ch = supabase
      .channel('realtime-suppliers')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'suppliers' }, async () => {
        if (!supabase) return;
        const { data } = await supabase.from('suppliers').select('id,name,phone,address').order('name', { ascending: true });
        if (!data) return;
        setRows((data as { id: string; name: string; phone?: string | null; address?: string | null }[]).map((s) => ({
          id: s.id,
          name: s.name,
          phone: s.phone || undefined,
          address: s.address || undefined,
        })));
      })
      .subscribe();
    return () => {
      if (supabase) supabase.removeChannel(ch);
    };
  }, []);

  const data = rows;

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Master Supplier</h1>
          <p className="text-gray-600 mt-1">Kelola pemasok obat dan alat kesehatan</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-lg hover:bg-emerald-700 transition-colors shadow-lg"
        >
          <Plus className="w-5 h-5" />
          <span className="font-medium">Tambah Supplier</span>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Nama</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Telepon</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Alamat</th>
                <th className="text-right py-4 px-6 text-sm font-semibold text-gray-700">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-4 px-6 text-sm font-medium text-gray-800 flex items-center gap-2">
                    <span className="w-8 h-8 bg-emerald-100 rounded-lg inline-flex items-center justify-center">
                      <Truck className="w-4 h-4 text-emerald-600" />
                    </span>
                    {row.name}
                  </td>
                  <td className="py-4 px-6 text-sm text-gray-600">{row.phone}</td>
                  <td className="py-4 px-6 text-sm text-gray-600">{row.address}</td>
                  <td className="py-4 px-6 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setEditId(row.id);
                          setEditName(row.name);
                          setEditPhone(row.phone || '');
                          setEditEmail('');
                          setEditAddress(row.address || '');
                          setShowEditModal(true);
                        }}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4 text-gray-600" />
                      </button>
                      <button
                        onClick={async () => {
                          if (!supabase) return;
                          await supabase.from('suppliers').update({ deleted_at: new Date().toISOString() }).eq('id', row.id);
                          setRows((prev) => prev.filter((r) => r.id !== row.id));
                        }}
                        className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                      >
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
              <h2 className="text-2xl font-bold text-gray-800">Tambah Supplier</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nama</label>
                <input
                  type="text"
                  placeholder="Nama supplier"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Telepon</label>
                  <input
                    type="tel"
                    placeholder="021-xxxxxxx"
                    value={addPhone}
                    onChange={(e) => setAddPhone(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <input
                    type="email"
                    placeholder="email@example.com"
                    value={addEmail}
                    onChange={(e) => setAddEmail(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Alamat</label>
                <textarea
                  rows={3}
                  placeholder="Alamat lengkap"
                  value={addAddress}
                  onChange={(e) => setAddAddress(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none"
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button onClick={() => setShowAddModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-gray-700">Batal</button>
              <button
                onClick={async () => {
                  const name = addName.trim();
                  if (!name) return;
                  if (!supabase) return;
                  const { data: inserted } = await supabase
                    .from('suppliers')
                    .insert({ name, phone: addPhone || null, email: addEmail || null, address: addAddress || null })
                    .select('id,name,phone,address')
                    .single();
                  if (inserted) {
                    setRows((prev) => [
                      ...prev,
                      {
                        id: inserted.id,
                        name: inserted.name,
                        phone: inserted.phone || undefined,
                        address: inserted.address || undefined,
                      },
                    ]);
                  }
                  setShowAddModal(false);
                  setAddName('');
                  setAddPhone('');
                  setAddEmail('');
                  setAddAddress('');
                }}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
      {showEditModal && editId !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-800">Edit Supplier</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nama</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Telepon</label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Alamat</label>
                <textarea
                  rows={3}
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none"
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditId(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-gray-700"
              >
                Batal
              </button>
              <button
                onClick={async () => {
                  if (!supabase || editId === null) return;
                  const name = editName.trim();
                  if (!name) return;
                  await supabase.from('suppliers').update({
                    name,
                    phone: editPhone || null,
                    email: editEmail || null,
                    address: editAddress || null,
                  }).eq('id', editId);
                  setRows((prev) => prev.map((r) => (r.id === editId ? { ...r, name, phone: editPhone || undefined, address: editAddress || undefined } : r)));
                  setShowEditModal(false);
                  setEditId(null);
                }}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
