import { Plus, Activity, Edit2, CheckCircle2, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

export default function MasterTindakan() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [rows, setRows] = useState<{ id: string | number; code?: string; name: string; price: number; active?: boolean }[]>([]);
  const [addCode, setAddCode] = useState<string>('');
  const [addName, setAddName] = useState<string>('');
  const [addPrice, setAddPrice] = useState<number>(0);
  const [addPriceStr, setAddPriceStr] = useState<string>('');
  const [editRow, setEditRow] = useState<{ id: string | number; code?: string; name: string; price: number; active?: boolean } | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editPrice, setEditPrice] = useState<number>(0);
  const [editPriceStr, setEditPriceStr] = useState<string>('');
  const [supportsCodeActive, setSupportsCodeActive] = useState<boolean>(true);
  const generateNextCode = async () => {
    if (!supabase) return 'TD-000001';
    const { data, error } = await supabase.from('procedures').select('code').eq('category', 'tindakan').order('code', { ascending: true });
    if (error && error.code === '42703') return 'TD-000001';
    const codes = (data || []).map((r) => r.code).filter(Boolean) as string[];
    let maxNum = 0;
    codes.forEach((c) => {
      const m = /^TD-(\d+)$/.exec(c);
      if (m) {
        const n = Number(m[1]);
        if (!Number.isNaN(n)) maxNum = Math.max(maxNum, n);
      }
    });
    const next = String(maxNum + 1).padStart(6, '0');
    return `TD-${next}`;
  };
  useEffect(() => {
    let active = true;
    const fetchProcedures = async () => {
      if (!supabase) return;
      const { data, error } = await supabase
        .from('procedures')
        .select('id,code,name,default_cost,active')
        .eq('category', 'tindakan')
        .is('deleted_at', null)
        .order('name', { ascending: true });
      if (error && error.code === '42703') {
        const { data: data2 } = await supabase
          .from('procedures')
          .select('id,name,default_cost')
          .is('deleted_at', null)
          .order('name', { ascending: true });
        if (!data2 || !active) return;
        setSupportsCodeActive(false);
        setRows((data2 as { id: string; name: string; default_cost?: number | null }[]).map((d) => ({
          id: d.id,
          code: undefined,
          name: d.name,
          price: Number(d.default_cost ?? 0),
          active: true,
        })));
        return;
      }
      if (!data || !active) return;
      setSupportsCodeActive(true);
      setRows((data as { id: string; code?: string | null; name: string; default_cost?: number | null; active?: boolean | null }[]).map((d) => ({
        id: d.id,
        code: d.code || undefined,
        name: d.name,
        price: Number(d.default_cost ?? 0),
        active: d.active ?? true,
      })));
    };
    fetchProcedures();
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!supabase) return;
    const ch = supabase
      .channel('realtime-procedures')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'procedures' }, async () => {
        if (!supabase) return;
        const { data, error } = await supabase
          .from('procedures')
          .select('id,code,name,default_cost,active')
          .eq('category', 'tindakan')
          .is('deleted_at', null)
          .order('name', { ascending: true });
        if (error && error.code === '42703') {
          const { data: data2 } = await supabase
            .from('procedures')
            .select('id,name,default_cost')
            .eq('category', 'tindakan')
            .is('deleted_at', null)
            .order('name', { ascending: true });
          if (!data2) return;
          setSupportsCodeActive(false);
          setRows((data2 as { id: string; name: string; default_cost?: number | null }[]).map((d) => ({
            id: d.id,
            code: undefined,
            name: d.name,
            price: Number(d.default_cost ?? 0),
            active: true,
          })));
          return;
        }
        if (!data) return;
        setSupportsCodeActive(true);
        setRows((data as { id: string; code?: string | null; name: string; default_cost?: number | null; active?: boolean | null }[]).map((d) => ({
          id: d.id,
          code: d.code || undefined,
          name: d.name,
          price: Number(d.default_cost ?? 0),
          active: d.active ?? true,
        })));
      })
      .subscribe();
    return () => {
      if (supabase) supabase.removeChannel(ch);
    };
  }, []);
  useEffect(() => {
    (async () => {
      if (!showAddModal) return;
      const code = await generateNextCode();
      setAddCode(code);
      setAddPrice(0);
      setAddPriceStr('');
    })();
  }, [showAddModal]);

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Master Tindakan</h1>
          <p className="text-gray-600 mt-1">Kelola daftar tindakan klinik</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-lg hover:bg-emerald-700 transition-colors shadow-lg"
        >
          <Plus className="w-5 h-5" />
          <span className="font-medium">Tambah Tindakan</span>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Kode</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Nama Tindakan</th>
                <th className="text-right py-4 px-6 text-sm font-semibold text-gray-700">Tarif</th>
                <th className="text-right py-4 px-6 text-sm font-semibold text-gray-700">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-4 px-6 text-sm text-gray-600">{row.code || '-'}</td>
                  <td className="py-4 px-6 text-sm font-medium text-gray-800 flex items-center gap-2">
                    <span className="w-8 h-8 bg-emerald-100 rounded-lg inline-flex items-center justify-center">
                      <Activity className="w-4 h-4 text-emerald-600" />
                    </span>
                    {row.name}
                  </td>
                  <td className="py-4 px-6 text-right text-sm font-semibold text-gray-800">
                    Rp {Number(row.price ?? 0).toLocaleString('id-ID')}
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setEditRow(row);
                          setEditName(row.name);
                          const num = Number(row.price ?? 0);
                          setEditPrice(num);
                          setEditPriceStr(new Intl.NumberFormat('id-ID').format(num));
                        }}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4 text-gray-600" />
                      </button>
                      <button
                        onClick={async () => {
                          if (!supabase) return;
                          const next = !(row.active ?? true);
                          const { error } = await supabase.from('procedures').update({ active: next }).eq('id', row.id);
                          if (error && error.code === '42703') {
                            await supabase.from('procedures').update({ deleted_at: next ? null : new Date().toISOString() }).eq('id', row.id);
                          }
                          setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, active: next } : r)));
                        }}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        title={
                          supportsCodeActive
                            ? (row.active ?? true) ? 'Nonaktifkan' : 'Aktifkan'
                            : (row.active ?? true) ? 'Hapus (kompatibilitas)' : 'Pulihkan (kompatibilitas)'
                        }
                      >
                        {(row.active ?? true) ? <XCircle className="w-4 h-4 text-gray-600" /> : <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
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
              <h2 className="text-2xl font-bold text-gray-800">Tambah Tindakan</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Kode</label>
                <input
                  type="text"
                  placeholder="TD-000001"
                  value={addCode}
                  disabled
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nama Tindakan</label>
                <input
                  type="text"
                  placeholder="Konsultasi Umum"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tarif</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">Rp</span>
                  <input
                    type="text"
                    placeholder="0"
                    value={addPriceStr}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^\d]/g, '');
                      const num = Number(raw || '0');
                      setAddPrice(num);
                      setAddPriceStr(raw ? new Intl.NumberFormat('id-ID').format(num) : '');
                    }}
                    className="w-full pl-12 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button onClick={() => setShowAddModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-gray-700">Batal</button>
              <button
                onClick={async () => {
                  const name = addName.trim();
                  if (!name || addPrice <= 0) return;
                  if (!supabase) return;
                  let inserted: { id: string; code?: string | null; name: string; default_cost?: number | null; active?: boolean | null } | null = null;
                  const { data, error } = await supabase
                    .from('procedures')
                    .insert({ code: addCode || null, name, default_cost: addPrice, active: true, category: 'tindakan' })
                    .select('id,code,name,default_cost,active')
                    .single();
                  if (error && error.code === '42703') {
                    const { data: data2 } = await supabase
                      .from('procedures')
                      .insert({ name, default_cost: addPrice })
                      .select('id,name,default_cost')
                      .single();
                    inserted = data2 || null;
                  } else {
                    inserted = data || null;
                  }
                  if (inserted) {
                    setRows((prev) => [
                      ...prev,
                      {
                        id: inserted.id,
                        code: inserted.code || undefined,
                        name: inserted.name,
                        price: Number(inserted.default_cost ?? 0),
                        active: inserted.active ?? true,
                      },
                    ]);
                  }
                  setShowAddModal(false);
                  setAddCode('');
                  setAddName('');
                  setAddPrice(0);
                  setAddPriceStr('');
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
              <h2 className="text-2xl font-bold text-gray-800">Edit Tindakan</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Kode</label>
                <input
                  type="text"
                  value={editRow?.code || ''}
                  disabled
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nama Tindakan</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tarif</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">Rp</span>
                  <input
                    type="text"
                    value={editPriceStr}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^\d]/g, '');
                      const num = Number(raw || '0');
                      setEditPrice(num);
                      setEditPriceStr(raw ? new Intl.NumberFormat('id-ID').format(num) : '');
                    }}
                    className="w-full pl-12 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button onClick={() => setEditRow(null)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-gray-700">Batal</button>
              <button
                onClick={async () => {
                  if (!supabase || !editRow) return;
                  const name = editName.trim();
                  if (!name || editPrice <= 0) return;
                  await supabase.from('procedures').update({ name, default_cost: editPrice }).eq('id', editRow.id);
                  setRows((prev) => prev.map((r) => (r.id === editRow.id ? { ...r, name, price: editPrice } : r)));
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
