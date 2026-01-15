import { Plus, FileText, Edit2, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

export default function MasterDiagnosa() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [rows, setRows] = useState<{ id: string | number; code?: string; name: string }[]>([]);
  const [addCode, setAddCode] = useState<string>('');
  const [addName, setAddName] = useState<string>('');
  const [editId, setEditId] = useState<string | number | null>(null);
  const [editCode, setEditCode] = useState<string>('');
  const [editName, setEditName] = useState<string>('');
  useEffect(() => {
    let active = true;
    const fetchDiagnoses = async () => {
      if (!supabase) return;
      const { data } = await supabase.from('diagnoses').select('id,code,name').is('deleted_at', null).order('name', { ascending: true });
      if (!data || !active) return;
      setRows((data as { id: string; code?: string | null; name: string }[]).map((d) => ({
        id: d.id,
        code: d.code || undefined,
        name: d.name,
      })));
    };
    fetchDiagnoses();
    return () => {
      active = false;
    };
  }, []);
  const generateNextCode = async () => {
    if (!supabase) return 'DG-000001';
    const { data } = await supabase.from('diagnoses').select('code').order('code', { ascending: true });
    const codes = (data || []).map((r: { code?: string | null }) => r.code).filter(Boolean) as string[];
    let maxNum = 0;
    codes.forEach((c) => {
      const m = /^DG-(\d+)$/.exec(c);
      if (m) {
        const n = Number(m[1]);
        if (!Number.isNaN(n)) maxNum = Math.max(maxNum, n);
      }
    });
    const next = String(maxNum + 1).padStart(6, '0');
    return `DG-${next}`;
  };
  useEffect(() => {
    (async () => {
      if (!showAddModal) return;
      const code = await generateNextCode();
      setAddCode(code);
    })();
  }, [showAddModal]);
  useEffect(() => {
    if (!supabase) return;
    const ch = supabase
      .channel('realtime-diagnoses')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'diagnoses' }, async () => {
        if (!supabase) return;
        const { data } = await supabase.from('diagnoses').select('id,code,name').is('deleted_at', null).order('name', { ascending: true });
        if (!data) return;
        setRows((data as { id: string; code?: string | null; name: string }[]).map((d) => ({
          id: d.id,
          code: d.code || undefined,
          name: d.name,
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
          <h1 className="text-3xl font-bold text-gray-800">Master Diagnosa</h1>
          <p className="text-gray-600 mt-1">Kelola daftar diagnosa (ICD-10) klinik</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-lg hover:bg-emerald-700 transition-colors shadow-lg"
        >
          <Plus className="w-5 h-5" />
          <span className="font-medium">Tambah Diagnosa</span>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Kode</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Nama Diagnosa</th>
                <th className="text-right py-4 px-6 text-sm font-semibold text-gray-700">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-4 px-6 text-sm text-gray-600">{row.code}</td>
                  <td className="py-4 px-6 text-sm font-medium text-gray-800 flex items-center gap-2">
                    <span className="w-8 h-8 bg-emerald-100 rounded-lg inline-flex items-center justify-center">
                      <FileText className="w-4 h-4 text-emerald-600" />
                    </span>
                    {row.name}
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setEditId(row.id);
                          setEditCode(row.code || '');
                          setEditName(row.name);
                          setShowEditModal(true);
                        }}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4 text-gray-600" />
                      </button>
                      <button
                        onClick={async () => {
                          if (!supabase) return;
                          await supabase.from('diagnoses').update({ deleted_at: new Date().toISOString() }).eq('id', row.id);
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
              <h2 className="text-2xl font-bold text-gray-800">Tambah Diagnosa</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Kode</label>
                <input
                  type="text"
                  placeholder="DG-000001"
                  value={addCode}
                  disabled
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nama Diagnosa</label>
                <input
                  type="text"
                  placeholder="Nama diagnosa"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
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
                    .from('diagnoses')
                    .insert({ code: addCode || null, name })
                    .select('id,code,name')
                    .single();
                  if (inserted) {
                    setRows((prev) => [...prev, { id: inserted.id, code: inserted.code || undefined, name: inserted.name }]);
                  }
                  setShowAddModal(false);
                  setAddCode('');
                  setAddName('');
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
              <h2 className="text-2xl font-bold text-gray-800">Edit Diagnosa</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Kode</label>
                <input
                  type="text"
                  value={editCode}
                  disabled
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nama Diagnosa</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
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
                  await supabase.from('diagnoses').update({ code: editCode || null, name }).eq('id', editId);
                  setRows((prev) => prev.map((r) => (r.id === editId ? { ...r, code: editCode || undefined, name } : r)));
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
