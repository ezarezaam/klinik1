import { useMemo, useState } from 'react';
import { Pill, Search, PlusCircle, MinusCircle, AlertTriangle, Calendar, Barcode, Truck } from 'lucide-react';
// Inventory state is provided from App

type Batch = { id: string; qty: number; expires?: string };
type InventoryItem = { id: number; name: string; unit: string; supplier?: string; minStock: number; batches: Batch[] };
interface StockProps {
  items: InventoryItem[];
  onAddBatch: (itemId: number, batch: Batch) => void;
  onReduceByItemId: (itemId: number, qty: number) => void;
  readOnly?: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');
const toISODate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const formatDate = (dateStr?: string) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function Stock({ items, onAddBatch, onReduceByItemId, readOnly = false }: StockProps) {
  const today = toISODate(new Date());
  const [query, setQuery] = useState('');
  const [showLowStock, setShowLowStock] = useState(false);
  const [showExpiredSoon, setShowExpiredSoon] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showReduceModal, setShowReduceModal] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [batchId, setBatchId] = useState<string>('');
  const [batchQty, setBatchQty] = useState<number>(0);
  const [batchExp, setBatchExp] = useState<string>(today);
  const [reduceQty, setReduceQty] = useState<number>(0);

  const totalStock = (it: InventoryItem) => it.batches.reduce((s, b) => s + b.qty, 0);
  const nearestExp = (it: InventoryItem) => {
    const exps = it.batches.map((b) => b.expires).filter(Boolean) as string[];
    if (exps.length === 0) return undefined;
    return exps.sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0];
  };
  const isExpiredSoon = (exp?: string) => {
    if (!exp) return false;
    const d = new Date(exp);
    const now = new Date();
    const diffDays = Math.floor((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 30;
  };
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      const t = totalStock(it);
      const ne = nearestExp(it);
      const low = showLowStock ? t <= it.minStock : true;
      const soon = showExpiredSoon ? isExpiredSoon(ne) : true;
      const text =
        !q ||
        it.name.toLowerCase().includes(q) ||
        (it.supplier || '').toLowerCase().includes(q) ||
        it.unit.toLowerCase().includes(q) ||
        it.batches.some((b) => b.id.toLowerCase().includes(q));
      return low && soon && text;
    });
  }, [items, query, showLowStock, showExpiredSoon]);

  const openAdd = (id: number) => {
    setSelectedId(id);
    setBatchId('');
    setBatchQty(0);
    setBatchExp(today);
    setShowAddModal(true);
  };
  const openReduce = (id: number) => {
    setSelectedId(id);
    setReduceQty(0);
    setShowReduceModal(true);
  };
  const saveAdd = () => {
    if (selectedId === null || batchQty <= 0) return;
    onAddBatch(selectedId, { id: batchId || `AUTO-${Date.now()}`, qty: batchQty, expires: batchExp || undefined });
    setShowAddModal(false);
  };
  const saveReduce = () => {
    if (selectedId === null || reduceQty <= 0) return;
    onReduceByItemId(selectedId, reduceQty);
    setShowReduceModal(false);
  };

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Stok Obat</h1>
          <p className="text-gray-600 mt-1">Inventory obat klinik</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
            <input
              type="checkbox"
              checked={showLowStock}
              onChange={(e) => setShowLowStock(e.target.checked)}
            />
            <span className="text-sm text-gray-700">Stok Rendah</span>
          </div>
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
            <input
              type="checkbox"
              checked={showExpiredSoon}
              onChange={(e) => setShowExpiredSoon(e.target.checked)}
            />
            <span className="text-sm text-gray-700">Kedaluwarsa ≤ 30 hari</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Cari obat (nama, batch, supplier, satuan)..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Obat</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Satuan</th>
                <th className="text-right py-4 px-6 text-sm font-semibold text-gray-700">Stok</th>
                <th className="text-right py-4 px-6 text-sm font-semibold text-gray-700">Min Stok</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Batch</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Exp Terdekat</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Supplier</th>
                <th className="text-right py-4 px-6 text-sm font-semibold text-gray-700">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((row) => {
                const t = totalStock(row);
                const ne = nearestExp(row);
                const low = t <= row.minStock;
                const soon = isExpiredSoon(ne);
                return (
                  <tr key={row.id} className="hover:bg-gray-50 transition-colors align-top">
                    <td className="py-4 px-6 text-sm font-medium text-gray-800">
                      <div className="flex items-center gap-2">
                        <span className="w-8 h-8 bg-emerald-100 rounded-lg inline-flex items-center justify-center">
                          <Pill className="w-4 h-4 text-emerald-600" />
                        </span>
                        {row.name}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-600">{row.unit}</td>
                    <td className={`py-4 px-6 text-right text-sm font-bold ${low ? 'text-red-600' : 'text-gray-800'}`}>{t}</td>
                    <td className="py-4 px-6 text-right text-sm text-gray-600">{row.minStock}</td>
                    <td className="py-4 px-6 text-sm text-gray-600">
                      <div className="flex flex-wrap gap-2">
                        {row.batches.map((b) => (
                          <span key={b.id} className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-xs">
                            <Barcode className="w-3 h-3" /> {b.id} • {b.qty}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-sm">
                      <div className="flex items-center gap-2">
                        <Calendar className={`w-4 h-4 ${soon ? 'text-amber-600' : 'text-gray-500'}`} />
                        <span className={`${soon ? 'text-amber-700 font-semibold' : 'text-gray-700'}`}>{formatDate(ne)}</span>
                        {soon && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs">
                            <AlertTriangle className="w-3 h-3" /> Segera
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-600">
                      <div className="inline-flex items-center gap-2">
                        <Truck className="w-4 h-4 text-gray-500" />
                        <span>{row.supplier || '-'}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-right">
                      {!readOnly && (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => openAdd(row.id)}
                            className="inline-flex items-center gap-2 px-3 py-2 border border-emerald-300 text-emerald-700 rounded-lg hover:bg-emerald-50 transition-colors text-sm font-medium"
                          >
                            <PlusCircle className="w-4 h-4" />
                            Tambah Stok
                          </button>
                          <button
                            onClick={() => openReduce(row.id)}
                            className="inline-flex items-center gap-2 px-3 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium"
                          >
                            <MinusCircle className="w-4 h-4" />
                            Keluarkan
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {!readOnly && showAddModal && selectedId !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-800">Tambah Stok</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Batch</label>
                <input
                  type="text"
                  value={batchId}
                  onChange={(e) => setBatchId(e.target.value)}
                  placeholder="Batch ID"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Jumlah</label>
                <input
                  type="number"
                  min={0}
                  value={batchQty}
                  onChange={(e) => setBatchQty(Number(e.target.value))}
                  placeholder="0"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Expired</label>
                <input
                  type="date"
                  value={batchExp}
                  onChange={(e) => setBatchExp(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button onClick={() => setShowAddModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-gray-700">Batal</button>
              <button onClick={saveAdd} className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium">Simpan</button>
            </div>
          </div>
        </div>
      )}

      {!readOnly && showReduceModal && selectedId !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-800">Keluarkan Stok</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Jumlah</label>
                <input
                  type="number"
                  min={0}
                  value={reduceQty}
                  onChange={(e) => setReduceQty(Number(e.target.value))}
                  placeholder="0"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button onClick={() => setShowReduceModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-gray-700">Batal</button>
              <button onClick={saveReduce} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium">Simpan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
