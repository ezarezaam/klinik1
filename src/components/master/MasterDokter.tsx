import { Plus, Stethoscope, Edit2, CheckCircle2, XCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

export default function MasterDokter() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [rows, setRows] = useState<{ id: string | number; name: string; poli?: string; sip?: string; active?: boolean }[]>([]);
  const [addName, setAddName] = useState<string>('');
  const [addPoli, setAddPoli] = useState<string>('');
  const [addSIP, setAddSIP] = useState<string>('');
  const [poliOptions, setPoliOptions] = useState<{ id: string; name: string }[]>([]);
  const [editRow, setEditRow] = useState<{ id: string | number; name: string; poli?: string; sip?: string } | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editPoli, setEditPoli] = useState<string>('');
  const [editSIP, setEditSIP] = useState<string>('');
  const fetchDoctors = useCallback(async () => {
    if (!supabase) return;
    const { data: polies } = await supabase.from('polies').select('id,name').is('deleted_at', null).order('name', { ascending: true });
    const pName = new Map<string, string>();
    (polies || []).forEach((p) => pName.set(p.id, p.name));
    setPoliOptions((polies || []).map((p) => ({ id: p.id, name: p.name })));
    const { data } = await supabase
      .from('doctors')
      .select('id,name,poli_id,sip,active')
      .order('name', { ascending: true });
    if (!data) return;
    setRows((data as { id: string; name: string; poli_id?: string | null; sip?: string | null; active?: boolean | null }[]).map((d) => ({
      id: d.id,
      name: d.name,
      poli: d.poli_id ? pName.get(d.poli_id) || undefined : undefined,
      sip: d.sip || undefined,
      active: d.active ?? true,
    })));
  }, []);
  useEffect(() => {
    fetchDoctors();
    return () => {
    };
  }, [fetchDoctors]);
  useEffect(() => {
    if (!supabase) return;
    const ch = supabase
      .channel('realtime-doctors')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'doctors' }, () => {
        fetchDoctors();
      })
      .subscribe();
    return () => {
      if (supabase) supabase.removeChannel(ch);
    };
  }, [fetchDoctors]);

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Master Dokter</h1>
          <p className="text-gray-600 mt-1">Kelola daftar dokter klinik</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-lg hover:bg-emerald-700 transition-colors shadow-lg"
        >
          <Plus className="w-5 h-5" />
          <span className="font-medium">Tambah Dokter</span>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Nama</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Poli</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">SIP</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Status</th>
                <th className="text-right py-4 px-6 text-sm font-semibold text-gray-700">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-4 px-6 text-sm font-medium text-gray-800 flex items-center gap-2">
                    <span className="w-8 h-8 bg-emerald-100 rounded-lg inline-flex items-center justify-center">
                      <Stethoscope className="w-4 h-4 text-emerald-600" />
                    </span>
                    {row.name}
                  </td>
                  <td className="py-4 px-6 text-sm text-gray-600">{row.poli || '-'}</td>
                  <td className="py-4 px-6 text-sm text-gray-600">{row.sip || '-'}</td>
                  <td className="py-4 px-6 text-sm">
                    {row.active ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700">
                        <CheckCircle2 className="w-4 h-4" /> Aktif
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-gray-500">
                        <XCircle className="w-4 h-4" /> Tidak aktif
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setEditRow(row);
                          setEditName(row.name);
                          const pid = poliOptions.find((p) => p.name === (row.poli || ''))?.id || '';
                          setEditPoli(pid);
                          setEditSIP(row.sip || '');
                        }}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4 text-gray-600" />
                      </button>
                      <button
                        onClick={async () => {
                          if (!supabase) return;
                          const next = !row.active;
                          await supabase.from('doctors').update({ active: next }).eq('id', row.id);
                          setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, active: next } : r)));
                        }}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        title={row.active ? 'Nonaktifkan' : 'Aktifkan'}
                      >
                        {row.active ? <XCircle className="w-4 h-4 text-gray-600" /> : <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
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
              <h2 className="text-2xl font-bold text-gray-800">Tambah Dokter</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nama</label>
                <input
                  type="text"
                  placeholder="dr. ..."
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Poli</label>
                <select
                  value={addPoli}
                  onChange={(e) => setAddPoli(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                >
                  <option value="">Pilih poli</option>
                  {poliOptions.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">SIP</label>
                <input
                  type="text"
                  placeholder="Nomor SIP"
                  value={addSIP}
                  onChange={(e) => setAddSIP(e.target.value)}
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
                  const poli_id = addPoli || null;
                  const { data: insertedDoc } = await supabase
                    .from('doctors')
                    .insert({ name, poli_id, sip: addSIP || null, active: true })
                    .select('id,name,poli_id,sip')
                    .single();
                  if (insertedDoc) {
                    setRows((prev) => [
                      ...prev,
                      {
                        id: insertedDoc.id,
                        name: insertedDoc.name,
                        poli: insertedDoc.poli_id ? (poliOptions.find((p) => p.id === insertedDoc.poli_id)?.name || undefined) : undefined,
                        sip: insertedDoc.sip || undefined,
                        active: true,
                      },
                    ]);
                  }
                  setShowAddModal(false);
                  setAddName('');
                  setAddPoli('');
                  setAddSIP('');
                }}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
      {editRow && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-800">Edit Dokter</h2>
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Poli</label>
                <select
                  value={editPoli}
                  onChange={(e) => setEditPoli(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                >
                  <option value="">Pilih poli</option>
                  {poliOptions.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">SIP</label>
                <input
                  type="text"
                  value={editSIP}
                  onChange={(e) => setEditSIP(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button onClick={() => setEditRow(null)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-gray-700">Batal</button>
              <button
                onClick={async () => {
                  if (!supabase || !editRow) return;
                  const name = editName.trim();
                  if (!name) return;
                  const poli_id = editPoli || null;
                  await supabase.from('doctors').update({ name, poli_id, sip: editSIP || null }).eq('id', editRow.id);
                  setRows((prev) =>
                    prev.map((r) =>
                      r.id === editRow.id
                        ? { ...r, name, poli: poli_id ? (poliOptions.find((p) => p.id === poli_id)?.name || undefined) : undefined, sip: editSIP || undefined }
                        : r
                    )
                  );
                  setEditRow(null);
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
