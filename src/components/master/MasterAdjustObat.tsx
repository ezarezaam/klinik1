import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Pill, PlusCircle, MinusCircle, Search, Eye, Calendar } from 'lucide-react';

type DrugRow = { id: string; name: string; unit?: string | null };
type BatchRow = { id: string; batch_code?: string | null; qty?: number | null; expires_at?: string | null };
type MovementRow = { created_at?: string | null; movement: 'IN' | 'OUT'; source?: string | null; quantity?: number | null; batch_id?: string | null };

export default function MasterAdjustObat() {
  const [query, setQuery] = useState('');
  const [drugs, setDrugs] = useState<DrugRow[]>([]);
  const [selectedDrugId, setSelectedDrugId] = useState<string | null>(null);
  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [showDetail, setShowDetail] = useState(false);
  const [movements, setMovements] = useState<MovementRow[]>([]);
  const [adjustMovements, setAdjustMovements] = useState<MovementRow[]>([]);

  const [inQty, setInQty] = useState<number>(0);
  const [inBatch, setInBatch] = useState<string>('');
  const [inExp, setInExp] = useState<string>('');
  const [outQty, setOutQty] = useState<number>(0);
  const [outBatch, setOutBatch] = useState<string>('');

  useEffect(() => {
    (async () => {
      if (!supabase) return;
      const { data } = await supabase.from('drugs').select('id,name,unit').is('deleted_at', null).order('name', { ascending: true });
      setDrugs((data || []) as DrugRow[]);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (!supabase || !selectedDrugId) return;
      const { data } = await supabase
        .from('drug_batches')
        .select('id,batch_code,qty,expires_at')
        .eq('drug_id', selectedDrugId)
        .is('deleted_at', null)
        .order('expires_at', { ascending: true });
      setBatches((data || []) as BatchRow[]);
      const { data: adj } = await supabase
        .from('inventory_movements')
        .select('created_at,movement,source,quantity,batch_id')
        .eq('drug_id', selectedDrugId)
        .eq('source', 'adjustment')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(50);
      setAdjustMovements((adj || []) as MovementRow[]);
    })();
  }, [selectedDrugId]);

  const totalQty = useMemo(() => (batches || []).reduce((sum, b) => sum + Number(b.qty ?? 0), 0), [batches]);
  const nearestExp = useMemo(() => {
    const dates = (batches || [])
      .map((b) => (b.expires_at ? new Date(b.expires_at).getTime() : Number.POSITIVE_INFINITY))
      .sort((a, b) => a - b);
    const ts = dates[0];
    if (!ts || !isFinite(ts)) return '-';
    const d = new Date(ts);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  }, [batches]);

  const filteredDrugs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q.length === 0 ? drugs : drugs.filter((d) => d.name.toLowerCase().includes(q));
  }, [query, drugs]);

  const doAdjust = async (movement: 'IN' | 'OUT') => {
    if (!supabase || !selectedDrugId) return;
    const qty = movement === 'IN' ? inQty : outQty;
    if (qty <= 0) return;
    const batchCode = movement === 'IN' ? inBatch : outBatch;
    const exp = movement === 'IN' ? (inExp || null) : null;
    await supabase.rpc('adjust_stock', {
      p_drug_id: selectedDrugId,
      p_quantity: qty,
      p_movement: movement,
      p_batch_code: batchCode || null,
      p_expires: exp,
    });
    const { data } = await supabase
      .from('drug_batches')
      .select('id,batch_code,qty,expires_at')
      .eq('drug_id', selectedDrugId)
      .is('deleted_at', null)
      .order('expires_at', { ascending: true });
    setBatches((data || []) as BatchRow[]);
    const { data: adj } = await supabase
      .from('inventory_movements')
      .select('created_at,movement,source,quantity,batch_id')
      .eq('drug_id', selectedDrugId)
      .eq('source', 'adjustment')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(50);
    setAdjustMovements((adj || []) as MovementRow[]);
    if (movement === 'IN') {
      setInQty(0);
      setInBatch('');
      setInExp('');
    } else {
      setOutQty(0);
      setOutBatch('');
    }
  };

  const openDetail = async () => {
    if (!supabase || !selectedDrugId) return;
    const { data } = await supabase
      .from('inventory_movements')
      .select('created_at,movement,source,quantity,batch_id')
      .eq('drug_id', selectedDrugId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    setMovements((data || []) as MovementRow[]);
    setShowDetail(true);
  };

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Adjust Stok Obat</h1>
          <p className="text-gray-600 mt-1">Penambahan dan pengurangan stok obat</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="md:col-span-2 relative">
            <label className="block text-sm font-medium text-gray-700 mb-2">Cari Obat</label>
            <Search className="absolute left-3 top-10 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Cari nama obat..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Pilih Obat</label>
            <select
              value={selectedDrugId || ''}
              onChange={(e) => setSelectedDrugId(e.target.value || null)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            >
              <option value="">Pilih obat</option>
              {filteredDrugs.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} {d.unit ? `(${d.unit})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
        {selectedDrugId && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Pill className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-semibold text-gray-800">Ringkasan Stok</span>
              </div>
              <div className="text-sm text-gray-600">Total stok</div>
              <div className="text-2xl font-bold text-gray-800">{totalQty}</div>
              <div className="mt-2 flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-gray-500" />
                <span className="text-gray-700">Expired terdekat: {nearestExp}</span>
              </div>
              <button
                type="button"
                onClick={openDetail}
                className="mt-3 inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
              >
                <Eye className="w-4 h-4" /> Lihat Movement
              </button>
            </div>
            <div className="p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <PlusCircle className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-semibold text-gray-800">Penambahan Stok</span>
              </div>
              <div className="space-y-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Jumlah</label>
                  <input
                    type="number"
                    min={0}
                    value={inQty}
                    onChange={(e) => setInQty(Number(e.target.value))}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Batch (opsional)</label>
                  <input
                    type="text"
                    value={inBatch}
                    onChange={(e) => setInBatch(e.target.value)}
                    placeholder="Contoh: ADJ-202601"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Expired (opsional)</label>
                  <input
                    type="date"
                    value={inExp}
                    onChange={(e) => setInExp(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => doAdjust('IN')}
                  className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
                >
                  Simpan Penambahan
                </button>
              </div>
            </div>
            <div className="p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <MinusCircle className="w-4 h-4 text-red-600" />
                <span className="text-sm font-semibold text-gray-800">Pengurangan Stok</span>
              </div>
              <div className="space-y-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Jumlah</label>
                  <input
                    type="number"
                    min={0}
                    value={outQty}
                    onChange={(e) => setOutQty(Number(e.target.value))}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Batch (opsional)</label>
                  <input
                    type="text"
                    value={outBatch}
                    onChange={(e) => setOutBatch(e.target.value)}
                    placeholder="Contoh: ADJ-202601"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => doAdjust('OUT')}
                  className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                >
                  Simpan Pengurangan
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {selectedDrugId && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-gray-800">Histori Penyesuaian</h2>
            <p className="text-sm text-gray-600">Menampilkan 50 penyesuaian terbaru</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left py-2 px-4 text-sm font-semibold text-gray-700">Waktu</th>
                  <th className="text-left py-2 px-4 text-sm font-semibold text-gray-700">Jenis</th>
                  <th className="text-right py-2 px-4 text-sm font-semibold text-gray-700">Jumlah</th>
                  <th className="text-left py-2 px-4 text-sm font-semibold text-gray-700">Batch</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {adjustMovements.length === 0 ? (
                  <tr>
                    <td className="py-3 px-4 text-sm text-gray-600" colSpan={4}>
                      Tidak ada penyesuaian
                    </td>
                  </tr>
                ) : (
                  adjustMovements.map((m, idx) => (
                    <tr key={idx}>
                      <td className="py-3 px-4 text-sm text-gray-700">{(m.created_at || '').replace('T', ' ').slice(0, 16)}</td>
                      <td className={`py-3 px-4 text-sm font-semibold ${m.movement === 'IN' ? 'text-emerald-700' : 'text-red-700'}`}>{m.movement}</td>
                      <td className={`py-3 px-4 text-right text-sm font-semibold ${m.movement === 'IN' ? 'text-emerald-700' : 'text-red-700'}`}>{Number(m.quantity ?? 0)}</td>
                      <td className="py-3 px-4 text-sm text-gray-700">{m.batch_id || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showDetail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-800">Detail Movement Stok</h2>
            </div>
            <div className="p-6 flex-1 overflow-y-auto">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left py-2 px-4 text-sm font-semibold text-gray-700">Waktu</th>
                      <th className="text-left py-2 px-4 text-sm font-semibold text-gray-700">Jenis</th>
                      <th className="text-left py-2 px-4 text-sm font-semibold text-gray-700">Sumber</th>
                      <th className="text-left py-2 px-4 text-sm font-semibold text-gray-700">Keterangan</th>
                      <th className="text-right py-2 px-4 text-sm font-semibold text-gray-700">Jumlah</th>
                      <th className="text-left py-2 px-4 text-sm font-semibold text-gray-700">Batch</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {movements.length === 0 ? (
                      <tr>
                        <td className="py-3 px-4 text-sm text-gray-600" colSpan={6}>
                          Tidak ada data movement
                        </td>
                      </tr>
                    ) : (
                      movements.map((m, idx) => (
                        <tr key={idx}>
                          <td className="py-3 px-4 text-sm text-gray-700">{(m.created_at || '').replace('T', ' ').slice(0, 16)}</td>
                          <td className={`py-3 px-4 text-sm font-semibold ${m.movement === 'IN' ? 'text-emerald-700' : 'text-red-700'}`}>{m.movement}</td>
                          <td className="py-3 px-4 text-sm text-gray-700">{m.source || '-'}</td>
                          <td className="py-3 px-4 text-sm text-gray-700">{`${m.movement === 'IN' ? 'IN dari' : 'OUT ke'} ${(() => { const s = (m.source || '').toLowerCase(); if (s === 'purchase') return 'Pembelian'; if (s === 'prescription') return 'Resep Pasien'; if (s === 'adjustment') return 'Penyesuaian'; if (s === 'prescription_adjust') return 'Penyesuaian Resep'; return m.source || '-'; })()}`}</td>
                          <td className={`py-3 px-4 text-right text-sm font-semibold ${m.movement === 'IN' ? 'text-emerald-700' : 'text-red-700'}`}>{Number(m.quantity ?? 0)}</td>
                          <td className="py-3 px-4 text-sm text-gray-700">{m.batch_id || '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200">
              <button
                onClick={() => setShowDetail(false)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-gray-700"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
