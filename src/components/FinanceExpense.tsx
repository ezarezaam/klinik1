import { FileText, Plus, Search, Calendar, CheckCircle2, Eye, Pencil, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

type ExpenseEntry = {
  id?: string;
  date: string;
  category: 'Pembelian Obat' | 'Bayar Dokter' | 'Lainnya';
  description: string;
  vendor?: string;
  doctorId?: string;
  amount: number;
  status?: 'draft' | 'selesai';
};

interface PurchaseItem {
  itemId: number;
  name: string;
  dose?: string;
  qty: number;
  expires?: string;
  batchId?: string;
  price?: number;
  tax?: number;
  total?: number;
}

interface FinanceExpenseProps {
  onAddPurchaseItems?: (items: PurchaseItem[]) => void;
}

export default function FinanceExpense({ onAddPurchaseItems }: FinanceExpenseProps) {
  void onAddPurchaseItems;
  const [query, setQuery] = useState('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [showAdd, setShowAdd] = useState(false);
  const [addDate, setAddDate] = useState<string>('');
  const [addCategory, setAddCategory] = useState<ExpenseEntry['category']>('Pembelian Obat');
  const [addDescription, setAddDescription] = useState<string>('');
  const [addVendor, setAddVendor] = useState<string>('');
  const [addAmount, setAddAmount] = useState<number>(0);
  const [addAmountStr, setAddAmountStr] = useState<string>('');
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([]);
  const [piItemId, setPiItemId] = useState<number>(-1);
  const [piQtyStr, setPiQtyStr] = useState<string>('');
  const [piExp, setPiExp] = useState<string>('');
  const [piPrice, setPiPrice] = useState<number>(0);
  const [piPriceStr, setPiPriceStr] = useState<string>('');
  const [piSearchQuery, setPiSearchQuery] = useState<string>('');
  const [piDrugErr, setPiDrugErr] = useState<boolean>(false);
  const [piQtyErr, setPiQtyErr] = useState<boolean>(false);
  const [piTax, setPiTax] = useState<number>(0);
  const [drugOptions, setDrugOptions] = useState<{ name: string; unit?: string; brand?: string; type?: string; dose?: string; dose_unit?: string }[]>([]);
  const [vendorOptions, setVendorOptions] = useState<{ name: string }[]>([]);
  const [doctorOptions, setDoctorOptions] = useState<{ id: string; name: string }[]>([]);
  const [addDoctorId, setAddDoctorId] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState<boolean>(false);
  const [detailEntry, setDetailEntry] = useState<ExpenseEntry | null>(null);
  const [detailItems, setDetailItems] = useState<{ name: string; qty: number; unit_price: number; tax: number; item_total: number; batch_code?: string | null; expires_at?: string | null }[]>([]);
  const [confirmDeleteEntry, setConfirmDeleteEntry] = useState<ExpenseEntry | null>(null);
  const [addDateErr, setAddDateErr] = useState<boolean>(false);
  const [addDescErr, setAddDescErr] = useState<boolean>(false);
  const [addAmountErr, setAddAmountErr] = useState<boolean>(false);
  const [addDoctorErr, setAddDoctorErr] = useState<boolean>(false);

  const filteredDrugs = useMemo(() => {
    const q = piSearchQuery.trim().toLowerCase();
    const tokens = q.split(/\s+/).filter(Boolean);
    return drugOptions
      .map((o, idx) => ({ name: o.name, unit: o.unit, brand: o.brand, type: o.type, dose: o.dose, dose_unit: o.dose_unit, index: idx }))
      .filter((d) => {
        if (tokens.length === 0) return true;
        const hay = `${d.name} ${d.brand || ''} ${d.type || ''} ${d.unit || ''}`.toLowerCase();
        return tokens.every((t) => hay.includes(t));
      });
  }, [drugOptions, piSearchQuery]);

  const [entries, setEntries] = useState<ExpenseEntry[]>([]);
  useEffect(() => {
    let active = true;
    const fetchExpenses = async () => {
      if (!supabase) return;
      const { data } = await supabase
        .from('finance_expenses')
        .select('id,date,category_name,description,vendor,doctor_id,doctor_name,amount,status')
        .is('deleted_at', null)
        .order('date', { ascending: false });
      if (!data || !active) return;
      type ExpenseRow = { id: string; date: string; category_name: string; description: string; vendor?: string | null; doctor_id?: string | null; doctor_name?: string | null; amount?: number | null; status?: 'draft' | 'selesai' | null };
      const mapped: ExpenseEntry[] = (data as ExpenseRow[]).map((e) => ({
        id: e.id,
        date: e.date,
        category: (e.category_name as ExpenseEntry['category']) || 'Lainnya',
        description: e.description,
        vendor: e.vendor || e.doctor_name || undefined,
        doctorId: e.doctor_id || undefined,
        amount: Number(e.amount ?? 0),
        status: (e.status as 'draft' | 'selesai' | undefined) || 'draft',
      }));
      setEntries(mapped);
    };
    fetchExpenses();
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    (async () => {
      if (!supabase) return;
      if (showDetail && detailEntry?.id) {
        const { data: items } = await supabase
          .from('purchase_items')
          .select('drug_id,qty,unit_price,tax,item_total,batch_code,expires_at')
          .eq('expense_id', detailEntry.id);
        const list = (items || []) as { drug_id: string; qty: number; unit_price?: number | null; tax?: number | null; item_total?: number | null; batch_code?: string | null; expires_at?: string | null }[];
        const ids = Array.from(new Set(list.map((it) => it.drug_id)));
        const { data: drugs } = await supabase.from('drugs').select('id,name').in('id', ids);
        const map = new Map<string, string>();
        ((drugs || []) as { id: string; name: string }[]).forEach((d) => map.set(d.id, d.name));
        setDetailItems(
          list.map((it) => ({
            name: map.get(it.drug_id) || '-',
            qty: Number(it.qty || 0),
            unit_price: Number(it.unit_price ?? 0),
            tax: Number(it.tax ?? 0),
            item_total: Number(it.item_total ?? 0),
            batch_code: it.batch_code || null,
            expires_at: it.expires_at || null,
          }))
        );
      } else {
        setDetailItems([]);
      }
    })();
  }, [showDetail, detailEntry?.id]);
  useEffect(() => {
    (async () => {
      if (!supabase) return;
      if (showAdd && editingId && addCategory === 'Pembelian Obat') {
        const { data: items } = await supabase
          .from('purchase_items')
          .select('drug_id,qty,unit_price,tax,item_total,batch_code,expires_at')
          .eq('expense_id', editingId);
        const list = (items || []) as { drug_id: string; qty: number; unit_price?: number | null; tax?: number | null; item_total?: number | null; batch_code?: string | null; expires_at?: string | null }[];
        const ids = Array.from(new Set(list.map((it) => it.drug_id)));
        const { data: drugs } = await supabase.from('drugs').select('id,name').in('id', ids);
        const map = new Map<string, string>();
        ((drugs || []) as { id: string; name: string }[]).forEach((d) => map.set(d.id, d.name));
        setPurchaseItems(
          list.map((it) => {
            const name = map.get(it.drug_id) || '-';
            const idx = drugOptions.findIndex((d) => d.name === name);
            const qty = Number(it.qty || 0);
            const price = Number(it.unit_price ?? 0);
            const taxPct = Number(it.tax ?? 0);
            const base = qty * price;
            const totalLine = Number(it.item_total ?? (base + base * (taxPct / 100)));
            return {
              itemId: idx >= 0 ? idx : -1,
              name,
              dose: idx >= 0 && drugOptions[idx]?.dose ? `${drugOptions[idx].dose}${drugOptions[idx].dose_unit ? ' ' + drugOptions[idx].dose_unit : ''}` : undefined,
              qty,
              price,
              tax: taxPct,
              total: totalLine,
              expires: it.expires_at || undefined,
              batchId: it.batch_code || undefined,
            };
          })
        );
      }
    })();
  }, [showAdd, editingId, addCategory, drugOptions]);
  useEffect(() => {
    if (!supabase) return;
    const ch = supabase
      .channel('realtime-finance-expenses')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'finance_expenses' }, async () => {
        if (!supabase) return;
        const { data } = await supabase
          .from('finance_expenses')
          .select('id,date,category_name,description,vendor,doctor_id,doctor_name,amount,status')
          .is('deleted_at', null)
          .order('date', { ascending: false });
        if (!data) return;
        type ExpenseRow = { id: string; date: string; category_name: string; description: string; vendor?: string | null; doctor_id?: string | null; doctor_name?: string | null; amount?: number | null; status?: 'draft' | 'selesai' | null };
        const mapped: ExpenseEntry[] = (data as ExpenseRow[]).map((e) => ({
          id: e.id,
          date: e.date,
          category: (e.category_name as ExpenseEntry['category']) || 'Lainnya',
          description: e.description,
          vendor: e.vendor || e.doctor_name || undefined,
          doctorId: e.doctor_id || undefined,
          amount: Number(e.amount ?? 0),
          status: (e.status as 'draft' | 'selesai' | undefined) || 'draft',
        }));
        setEntries(mapped);
      })
      .subscribe();
    return () => {
      if (supabase) supabase.removeChannel(ch);
    };
  }, []);
  useEffect(() => {
    let active = true;
    (async () => {
      if (!supabase) return;
      const { data } = await supabase.from('drugs').select('name,unit,brand,type,active,dose,dose_unit').order('name', { ascending: true });
      if (!data || !active) return;
      setDrugOptions(
        (data as { name: string; unit?: string | null; brand?: string | null; type?: string | null; active?: boolean | null; dose?: string | null; dose_unit?: string | null }[])
          .filter((d) => d.active ?? true)
          .map((d) => ({ name: d.name, unit: d.unit || undefined, brand: d.brand || undefined, type: d.type || undefined, dose: d.dose || undefined, dose_unit: d.dose_unit || undefined }))
      );
    })();
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    (async () => {
      if (!supabase) return;
      const { data } = await supabase.from('suppliers').select('name').order('name', { ascending: true });
      if (!data || !active) return;
      setVendorOptions((data as { name: string }[]).map((s) => ({ name: s.name })));
    })();
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    (async () => {
      if (!supabase) return;
      const { data } = await supabase.from('doctors').select('id,name,active').order('name', { ascending: true });
      if (!data || !active) return;
      setDoctorOptions((data as { id: string; name: string; active?: boolean | null }[]).filter((d) => d.active ?? true).map((d) => ({ id: d.id, name: d.name })));
    })();
    return () => {
      active = false;
    };
  }, []);

  const formatCurrency = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      const matchesQuery =
        q.length === 0 ||
        e.description.toLowerCase().includes(q) ||
        (e.vendor || '').toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q);
      const afterStart = startDate ? e.date >= startDate : true;
      const beforeEnd = endDate ? e.date <= endDate : true;
      return matchesQuery && afterStart && beforeEnd;
    });
  }, [entries, query, startDate, endDate]);
  const total = filtered.reduce((sum, e) => sum + e.amount, 0);
  const [confirmFinishEntry, setConfirmFinishEntry] = useState<ExpenseEntry | null>(null);

  const purchaseTotal = useMemo(() => {
    return purchaseItems.reduce((sum, it) => {
      const qty = Number(it.qty || 0);
      const price = Number(it.price ?? 0);
      const taxPct = Number(it.tax ?? 0);
      const base = qty * price;
      const totalLine = Number(it.total ?? (base + base * (taxPct / 100)));
      return sum + totalLine;
    }, 0);
  }, [purchaseItems]);

  useEffect(() => {
    if (addCategory === 'Pembelian Obat') {
      const s = purchaseTotal;
      setAddAmount(s);
      setAddAmountStr(s > 0 ? new Intl.NumberFormat('id-ID').format(s) : '');
      setAddAmountErr(!(s > 0));
    }
  }, [addCategory, purchaseTotal]);

  return (
    <div className="p-8">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Pengeluaran</h1>
              <p className="text-gray-600 mt-1">Pengeluaran operasional: pembelian obat, honor dokter, dan lainnya</p>
            </div>
            <button
              onClick={() => {
                setAddDate('');
                setAddCategory('Pembelian Obat');
                setAddDescription('');
                setAddVendor('');
                setAddAmount(0);
                setPurchaseItems([]);
                setPiItemId(-1);
                setPiQtyStr('');
                setPiExp('');
                setPiPrice(0);
                setPiPriceStr('');
                setPiSearchQuery('');
                setPiDrugErr(false);
                setPiQtyErr(false);
                setPiTax(0);
                setShowAdd(true);
                setEditingId(null);
              }}
              className="flex items-center gap-2 bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-colors shadow-lg"
            >
              <Plus className="w-5 h-5" />
              <span className="font-medium">Tambah Pengeluaran</span>
            </button>
          </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-red-100 rounded-xl flex items-center justify-center">
            <FileText className="w-7 h-7 text-red-600" />
          </div>
          <div>
            <p className="text-sm text-gray-600">Total Pengeluaran (filter saat ini)</p>
            <p className="text-3xl font-bold text-red-600">{formatCurrency(total)}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Cari pengeluaran (vendor, kategori, deskripsi)..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-600" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                />
            <span className="text-gray-500">-</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Tanggal</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Kategori</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Deskripsi</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Vendor</th>
                <th className="text-right py-4 px-6 text-sm font-semibold text-gray-700">Jumlah</th>
                <th className="text-center py-4 px-6 text-sm font-semibold text-gray-700">Status</th>
                <th className="text-center py-4 px-6 text-sm font-semibold text-gray-700">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((e, idx) => (
                <tr key={`${e.date}-${e.description}-${idx}`} className="hover:bg-gray-50 transition-colors">
                  <td className="py-4 px-6 text-sm text-gray-600">{e.date}</td>
                  <td className="py-4 px-6 text-sm text-gray-800 font-medium">{e.category}</td>
                  <td className="py-4 px-6 text-sm text-gray-600">{e.description}</td>
                  <td className="py-4 px-6 text-sm text-gray-600">{e.vendor || '-'}</td>
                  <td className="py-4 px-6 text-right text-sm font-semibold text-red-600">{formatCurrency(e.amount)}</td>
                  <td className="py-4 px-6 text-center">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${e.status === 'selesai' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {e.status === 'selesai' ? 'Selesai' : 'Draft'}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <div className="inline-flex items-center gap-3">
                      <button
                        type="button"
                        className="text-gray-600 hover:text-gray-800"
                        onClick={() => {
                          setDetailEntry(e);
                          setShowDetail(true);
                        }}
                        title="Detail"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                      {e.status !== 'selesai' && (
                        <button
                          type="button"
                          className={`text-emerald-600 hover:text-emerald-700 ${e.id ? '' : 'opacity-50 cursor-not-allowed'}`}
                          onClick={() => {
                            if (!e.id) return;
                            setConfirmFinishEntry(e);
                          }}
                          title="Tandai selesai"
                        >
                          <CheckCircle2 className="w-5 h-5" />
                        </button>
                      )}
                      <button
                        type="button"
                        className={`text-emerald-600 hover:text-emerald-700 ${e.id && e.status !== 'selesai' ? '' : 'opacity-50 cursor-not-allowed'}`}
                        onClick={() => {
                          if (!e.id || e.status === 'selesai') return;
                          setEditingId(e.id);
                          setAddDate(e.date);
                          setAddCategory(e.category);
                          setAddDescription(e.description);
                          if (e.category === 'Bayar Dokter') {
                            setAddVendor('');
                            setAddDoctorId(e.doctorId || '');
                          } else {
                            setAddVendor(e.vendor || '');
                            setAddDoctorId('');
                          }
                          setAddAmount(e.amount);
                          setAddAmountStr(e.amount > 0 ? new Intl.NumberFormat('id-ID').format(e.amount) : '');
                          setPurchaseItems([]);
                          setPiItemId(-1);
                          setPiQtyStr('');
                          setPiExp('');
                          setPiPrice(0);
                          setPiPriceStr('');
                          setPiSearchQuery('');
                          setPiDrugErr(false);
                          setPiQtyErr(false);
                          setPiTax(0);
                          setShowAdd(true);
                        }}
                        title="Edit"
                      >
                        <Pencil className="w-5 h-5" />
                      </button>
                      <button
                        type="button"
                        className={`text-red-600 hover:text-red-700 ${e.id && e.status !== 'selesai' ? '' : 'opacity-50 cursor-not-allowed'}`}
                        onClick={() => {
                          if (!e.id || e.status === 'selesai') return;
                          setConfirmDeleteEntry(e);
                        }}
                        title="Hapus"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl mx-4 max-h-[85vh] flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-800">{editingId ? 'Edit Pengeluaran' : 'Tambah Pengeluaran'}</h2>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tanggal</label>
                  <input
                    type="date"
                    value={addDate}
                    onChange={(e) => {
                      setAddDate(e.target.value);
                      if (e.target.value) setAddDateErr(false);
                    }}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 outline-none ${addDateErr ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-red-500 focus:border-red-500'}`}
                  />
                  {addDateErr && <div className="text-xs text-red-600 mt-1">Wajib diisi</div>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Kategori</label>
                  <select
                    value={addCategory}
                    onChange={(e) => setAddCategory(e.target.value as ExpenseEntry['category'])}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                  >
                    <option value="Pembelian Obat">Pembelian Obat</option>
                    <option value="Bayar Dokter">Bayar Dokter</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>
              </div>
              {addCategory === 'Pembelian Obat' && (
                <>
                  <div className="border border-gray-200 rounded-lg p-4">
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
                    <div className="md:col-span-2 relative">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Obat</label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input
                          type="text"
                          value={piSearchQuery}
                          onChange={(e) => { setPiSearchQuery(e.target.value); if (piDrugErr) setPiDrugErr(false); }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              // Jangan auto-pilih; wajib klik saran
                              if (piDrugErr) setPiDrugErr(false);
                            }
                          }}
                          placeholder="Ketik nama/jenis (multi kata)"
                          className={`w-full pl-9 pr-4 py-2 border rounded-lg focus:ring-2 outline-none ${piDrugErr ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-red-500 focus:border-red-500'}`}
                        />
                      </div>
                      {piSearchQuery.trim().length >= 2 && (
                        <div className="absolute left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-auto z-10">
                          {filteredDrugs.slice(0, 12).map((d) => (
                            <button
                              key={`${d.name}-${d.index}`}
                              type="button"
                              onClick={() => {
                                setPiItemId(d.index);
                                setPiSearchQuery('');
                                setPiDrugErr(false);
                              }}
                              className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm text-gray-800"
                            >
                              {d.name}
                              {(d.type || d.unit || d.brand || d.dose) ? (
                                <span className="text-gray-500"> • {[d.type, d.unit, d.brand, d.dose ? `${d.dose}${d.dose_unit ? ' ' + d.dose_unit : ''}` : null].filter(Boolean).join(' • ')}</span>
                              ) : null}
                            </button>
                          ))}
                        </div>
                      )}
                      {piItemId >= 0 && piItemId < drugOptions.length && (
                        <div className="mt-2 inline-flex items-center gap-2 px-2 py-1 bg-emerald-50 text-emerald-700 rounded-md text-xs">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>
                            {drugOptions[piItemId].name}
                            {(drugOptions[piItemId].type || drugOptions[piItemId].unit || drugOptions[piItemId].brand || drugOptions[piItemId].dose) ? (
                              <span> • {[drugOptions[piItemId].type, drugOptions[piItemId].unit, drugOptions[piItemId].brand, drugOptions[piItemId].dose ? `${drugOptions[piItemId].dose}${drugOptions[piItemId].dose_unit ? ' ' + drugOptions[piItemId].dose_unit : ''}` : null].filter(Boolean).join(' • ')}</span>
                            ) : null}
                          </span>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Jumlah</label>
                      <input
                        type="number"
                        min={0}
                          value={piQtyStr}
                          onChange={(e) => { const v = e.target.value; setPiQtyStr(v); const num = Number(v || '0'); if (num > 0 && piQtyErr) setPiQtyErr(false); }}
                          placeholder="0"
                          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 outline-none ${piQtyErr ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-red-500 focus:border-red-500'}`}
                        />
                        {piQtyErr && <div className="text-xs text-red-600 mt-1">Wajib lebih dari 0</div>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Harga per item</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">Rp</span>
                        <input
                          type="text"
                          value={piPriceStr}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/[^\d]/g, '');
                            const num = Number(raw || '0');
                            setPiPrice(num);
                            setPiPriceStr(raw ? new Intl.NumberFormat('id-ID').format(num) : '');
                          }}
                          placeholder="0"
                          className="w-full pl-12 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Pajak (%)</label>
                      <div className="relative">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step="0.01"
                          value={piTax}
                          onChange={(e) => {
                            const num = Number(e.target.value);
                            setPiTax(Number.isFinite(num) ? num : 0);
                          }}
                          placeholder="0"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                      </div>
                    </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Expired (Opsional)</label>
                        <input
                          type="date"
                          value={piExp}
                          onChange={(e) => setPiExp(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => {
                        const idx = piItemId;
                        if (idx < 0 || idx >= drugOptions.length) {
                          setPiDrugErr(true);
                          return;
                        }
                        const qtyNum = Number(piQtyStr || '0');
                        if (qtyNum <= 0) {
                          setPiQtyErr(true);
                          return;
                        }
                        if (qtyNum > 0 && idx >= 0 && idx < drugOptions.length) {
                          const selected = drugOptions[idx];
                          const d = addDate && /^\d{4}-\d{2}-\d{2}$/.test(addDate) ? addDate.replace(/-/g, '') : new Date().toISOString().slice(0,10).replace(/-/g,'');
                          const prefix = (selected.name || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0,4) || 'DRUG';
                          const rand = Math.floor(1000 + Math.random() * 9000);
                          const autoBatch = `B-${d}-${prefix}-${rand}`;
                          const base = qtyNum * piPrice;
                          const totalLine = base + base * (piTax / 100);
                          setPurchaseItems((prev) => [
                            ...prev,
                            {
                              itemId: idx,
                              name: selected.name,
                              dose: selected.dose ? `${selected.dose}${selected.dose_unit ? ' ' + selected.dose_unit : ''}` : undefined,
                              qty: qtyNum,
                              price: piPrice,
                              tax: piTax,
                              total: totalLine,
                              expires: piExp || undefined,
                              batchId: autoBatch,
                            },
                          ]);
                          setPiQtyStr('');
                          setPiExp('');
                          setPiPrice(0);
                          setPiPriceStr('');
                          setPiTax(0);
                          setPiItemId(-1);
                          setPiDrugErr(false);
                        }
                      }}
                      className="px-3 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium"
                    >
                      Tambah Item
                    </button>
                  </div>
                  {purchaseItems.length > 0 && (
                    <div className="mt-4">
                      <div className="text-sm font-semibold text-gray-700 mb-2">Item Pembelian:</div>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                              <th className="text-left py-2 px-4 text-sm font-semibold text-gray-700">Obat</th>
                              <th className="text-left py-2 px-4 text-sm font-semibold text-gray-700">Dosis</th>
                              <th className="text-left py-2 px-4 text-sm font-semibold text-gray-700">Jumlah</th>
                              <th className="text-left py-2 px-4 text-sm font-semibold text-gray-700">Harga/item</th>
                              <th className="text-left py-2 px-4 text-sm font-semibold text-gray-700">Pajak</th>
                              <th className="text-left py-2 px-4 text-sm font-semibold text-gray-700">Total</th>
                              <th className="text-left py-2 px-4 text-sm font-semibold text-gray-700">Expired</th>
                              <th className="text-left py-2 px-4 text-sm font-semibold text-gray-700">Batch</th>
                              <th className="text-center py-2 px-4 text-sm font-semibold text-gray-700">Aksi</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {purchaseItems.map((it, idx) => (
                              <tr key={`${it.itemId}-${idx}`}>
                                <td className="py-2 px-4 text-sm text-gray-700">{it.name}</td>
                                <td className="py-2 px-4 text-sm text-gray-700">{it.dose || '-'}</td>
                                <td className="py-2 px-4 text-sm text-gray-700">{it.qty}</td>
                                <td className="py-2 px-4 text-sm text-gray-700">{formatCurrency(it.price || 0)}</td>
                                <td className="py-2 px-4 text-sm text-gray-700">{`${Number(it.tax ?? 0).toFixed(2)}%`}</td>
                                <td className="py-2 px-4 text-sm text-gray-700">{formatCurrency(it.total || 0)}</td>
                                <td className="py-2 px-4 text-sm text-gray-700">{it.expires || '-'}</td>
                                <td className="py-2 px-4 text-sm text-gray-700">{it.batchId || '-'}</td>
                                <td className="py-2 px-4 text-center">
                                  <button
                                    type="button"
                                    className="text-red-600 hover:text-red-700"
                                    onClick={() => {
                                      setPurchaseItems((prev) => prev.filter((_, i) => i !== idx));
                                    }}
                                    title="Hapus item"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
              <div>
                {addCategory === 'Bayar Dokter' ? (
                  <>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Dokter</label>
                    <select
                      value={addDoctorId}
                      onChange={(e) => {
                        setAddDoctorId(e.target.value);
                        if (e.target.value) setAddDoctorErr(false);
                      }}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 outline-none ${addDoctorErr ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-red-500 focus:border-red-500'}`}
                    >
                      <option value="">Pilih dokter</option>
                      {doctorOptions.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                    {addDoctorErr && <div className="text-xs text-red-600 mt-1">Wajib diisi</div>}
                  </>
                ) : (
                  <>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Vendor (Opsional)</label>
                    <select
                      value={addVendor}
                      onChange={(e) => setAddVendor(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                    >
                      <option value="">Pilih supplier</option>
                      {vendorOptions.map((v) => (
                        <option key={v.name} value={v.name}>{v.name}</option>
                      ))}
                    </select>
                  </>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Deskripsi</label>
                <input
                  type="text"
                  value={addDescription}
                  onChange={(e) => {
                    setAddDescription(e.target.value);
                    if (e.target.value.trim()) setAddDescErr(false);
                  }}
                  placeholder="Keterangan pengeluaran"
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 outline-none ${addDescErr ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-red-500 focus:border-red-500'}`}
                />
                {addDescErr && <div className="text-xs text-red-600 mt-1">Wajib diisi</div>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Jumlah</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">Rp</span>
                  <input
                    type="text"
                    value={addAmountStr}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^\d]/g, '');
                      const num = Number(raw || '0');
                      setAddAmount(num);
                      setAddAmountStr(raw ? new Intl.NumberFormat('id-ID').format(num) : '');
                      if (num > 0) setAddAmountErr(false);
                    }}
                    placeholder={addCategory === 'Pembelian Obat' ? 'Otomatis dari item' : '0'}
                    disabled={addCategory === 'Pembelian Obat'}
                    className={`w-full pl-12 pr-4 py-2 border rounded-lg focus:ring-2 outline-none ${
                      addCategory === 'Pembelian Obat' ? 'bg-gray-50 cursor-not-allowed' : ''
                    } ${addAmountErr ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-red-500 focus:border-red-500'}`}
                  />
                </div>
                {addAmountErr && (
                  <div className="text-xs text-red-600 mt-1">
                    {addCategory === 'Pembelian Obat' ? 'Tambahkan item pembelian' : 'Wajib diisi'}
                  </div>
                )}
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button onClick={() => setShowAdd(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-gray-700">Batal</button>
              <button
                onClick={async () => {
                  const needDoctor = addCategory === 'Bayar Dokter';
                  const hasErr = !addDate || !addDescription.trim() || addAmount <= 0 || (needDoctor && !addDoctorId);
                  setAddDateErr(!addDate);
                  setAddDescErr(!addDescription.trim());
                  setAddAmountErr(!(addAmount > 0));
                  setAddDoctorErr(needDoctor && !addDoctorId);
                  if (hasErr) return;
                  if (supabase) {
                    if (editingId) {
                      const { data: updated, error: eUpd } = await supabase
                        .from('finance_expenses')
                        .update({
                          date: addDate,
                          category_name: addCategory,
                          description: addDescription,
                          vendor: addCategory === 'Bayar Dokter' ? null : addVendor,
                          doctor_id: addCategory === 'Bayar Dokter' ? (addDoctorId || null) : null,
                          doctor_name: addCategory === 'Bayar Dokter' ? (doctorOptions.find((d) => d.id === addDoctorId)?.name || null) : null,
                          amount: addAmount,
                        })
                        .eq('id', editingId)
                        .select()
                        .single();
                      if (!eUpd && updated) {
                        setEntries((prev) =>
                          prev.map((en) =>
                            en.id === editingId
                              ? {
                                  id: updated.id,
                                  date: updated.date,
                                  category: (updated.category_name as ExpenseEntry['category']) || 'Lainnya',
                                  description: updated.description,
                                  vendor: updated.vendor || updated.doctor_name || undefined,
                                  doctorId: updated.doctor_id || undefined,
                                  amount: Number(updated.amount ?? 0),
                                  status: (updated.status as 'draft' | 'selesai' | undefined) || en.status || 'draft',
                                }
                              : en
                          )
                        );
                      }
                    } else {
                      const { data: exp, error: eExp } = await supabase
                        .from('finance_expenses')
                        .insert({
                          date: addDate,
                          category_name: addCategory,
                          description: addDescription,
                          vendor: addCategory === 'Bayar Dokter' ? null : addVendor,
                          doctor_id: addCategory === 'Bayar Dokter' ? (addDoctorId || null) : null,
                          doctor_name: addCategory === 'Bayar Dokter' ? (doctorOptions.find((d) => d.id === addDoctorId)?.name || null) : null,
                          amount: addAmount,
                          status: 'draft',
                        })
                        .select()
                        .single();
                      if (!eExp && exp) {
                        if (addCategory === 'Pembelian Obat' && purchaseItems.length > 0) {
                          const names = purchaseItems.map((it) => it.name);
                          const { data: existing } = await supabase
                            .from('drugs')
                            .select('id,name')
                            .in('name', names);
                          const mapId = new Map<string, string>();
                          (existing || []).forEach((d) => mapId.set(d.name, d.id));
                          const missing = names.filter((n) => !mapId.has(n));
                          if (missing.length > 0) {
                            const toInsert = missing.map((n) => ({
                              name: n,
                              unit: 'Unit',
                              price: Number(purchaseItems.find((it) => it.name === n)?.price ?? 0),
                              min_stock: 0,
                            }));
                            const { data: inserted } = await supabase
                              .from('drugs')
                              .insert(toInsert)
                              .select('id,name');
                            (inserted || []).forEach((d) => mapId.set(d.name, d.id));
                          }
                          const payload = purchaseItems
                            .map((it) => {
                              const drug_id = mapId.get(it.name);
                              if (!drug_id) return null;
                              const qty = Number(it.qty || 0);
                              const price = Number(it.price ?? 0);
                              const taxPct = Number(it.tax ?? 0);
                              const base = qty * price;
                              return {
                                expense_id: exp.id,
                                drug_id,
                                qty,
                                batch_code: it.batchId || null,
                                expires_at: it.expires || null,
                                unit_price: price,
                                tax: taxPct,
                                item_total: Number(it.total ?? (base + base * (taxPct / 100))),
                              };
                            })
                            .filter(Boolean) as {
                            expense_id: string;
                            drug_id: string;
                            qty: number;
                            batch_code: string | null;
                            expires_at: string | null;
                            unit_price: number;
                            tax: number;
                            item_total: number;
                          }[];
                          if (payload.length > 0) {
                            await supabase.from('purchase_items').insert(payload);
                          }
                        }
                        setEntries((prev) => [
                          ...prev,
                          { id: exp.id, date: addDate, category: addCategory, description: addDescription, vendor: addCategory === 'Bayar Dokter' ? (doctorOptions.find((d) => d.id === addDoctorId)?.name || undefined) : addVendor, doctorId: addCategory === 'Bayar Dokter' ? addDoctorId || undefined : undefined, amount: addAmount, status: 'draft' },
                        ]);
                      }
                    }
                  } else {
                    if (editingId) {
                      setEntries((prev) =>
                        prev.map((en) =>
                          en.id === editingId
                            ? { ...en, date: addDate, category: addCategory, description: addDescription, vendor: addCategory === 'Bayar Dokter' ? (doctorOptions.find((d) => d.id === addDoctorId)?.name || undefined) : addVendor, doctorId: addCategory === 'Bayar Dokter' ? addDoctorId || undefined : undefined, amount: addAmount }
                            : en
                        )
                      );
                    } else {
                      setEntries((prev) => [
                        ...prev,
                        { date: addDate, category: addCategory, description: addDescription, vendor: addCategory === 'Bayar Dokter' ? (doctorOptions.find((d) => d.id === addDoctorId)?.name || undefined) : addVendor, doctorId: addCategory === 'Bayar Dokter' ? addDoctorId || undefined : undefined, amount: addAmount, status: 'draft' },
                      ]);
                    }
                  }
                  setShowAdd(false);
                  setEditingId(null);
                  setAddAmount(0);
                  setAddAmountStr('');
                  setAddVendor('');
                  setAddDoctorId('');
                  setAddDateErr(false);
                  setAddDescErr(false);
                  setAddAmountErr(false);
                  setAddDoctorErr(false);
                }}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
      {showDetail && detailEntry && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl mx-4">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-800">Detail Pengeluaran</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Tanggal</span>
                <span className="text-gray-800 font-medium">{detailEntry.date}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Kategori</span>
                <span className="text-gray-800 font-medium">{detailEntry.category}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Deskripsi</span>
                <span className="text-gray-800 font-medium">{detailEntry.description}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Vendor/Dokter</span>
                <span className="text-gray-800 font-medium">{detailEntry.vendor || '-'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Jumlah</span>
                <span className="text-red-600 font-semibold">{formatCurrency(detailEntry.amount)}</span>
              </div>
              {detailEntry.category === 'Pembelian Obat' && (
                <div className="mt-2">
                  <div className="text-sm font-semibold text-gray-700 mb-2">Item Pembelian</div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="text-left py-2 px-4 text-sm font-semibold text-gray-700">Obat</th>
                          <th className="text-left py-2 px-4 text-sm font-semibold text-gray-700">Jumlah</th>
                          <th className="text-left py-2 px-4 text-sm font-semibold text-gray-700">Harga/item</th>
                          <th className="text-left py-2 px-4 text-sm font-semibold text-gray-700">Pajak</th>
                          <th className="text-left py-2 px-4 text-sm font-semibold text-gray-700">Total</th>
                          <th className="text-left py-2 px-4 text-sm font-semibold text-gray-700">Expired</th>
                          <th className="text-left py-2 px-4 text-sm font-semibold text-gray-700">Batch</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {detailItems.map((it, idx) => (
                          <tr key={`${it.name}-${idx}`}>
                            <td className="py-2 px-4 text-sm text-gray-700">{it.name}</td>
                            <td className="py-2 px-4 text-sm text-gray-700">{it.qty}</td>
                            <td className="py-2 px-4 text-sm text-gray-700">{formatCurrency(it.unit_price || 0)}</td>
                            <td className="py-2 px-4 text-sm text-gray-700">{`${Number(it.tax ?? 0).toFixed(2)}%`}</td>
                            <td className="py-2 px-4 text-sm text-gray-700">{formatCurrency(it.item_total || 0)}</td>
                            <td className="py-2 px-4 text-sm text-gray-700">{it.expires_at || '-'}</td>
                            <td className="py-2 px-4 text-sm text-gray-700">{it.batch_code || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-gray-200">
              <button onClick={() => { setShowDetail(false); setDetailEntry(null); }} className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-gray-700">Tutup</button>
            </div>
          </div>
        </div>
      )}
      {confirmDeleteEntry && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-800">Konfirmasi Hapus</h2>
            </div>
            <div className="p-6 space-y-3">
              <div className="text-sm text-gray-700">
                Apakah Anda yakin ingin menghapus pengeluaran ini?
              </div>
              <div className="text-sm text-gray-600">
                {confirmDeleteEntry.date} • {confirmDeleteEntry.category} • {confirmDeleteEntry.description}
              </div>
              <div className="text-sm font-semibold text-red-600">
                {formatCurrency(confirmDeleteEntry.amount)}
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => setConfirmDeleteEntry(null)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-gray-700"
              >
                Batal
              </button>
              <button
                onClick={async () => {
                  if (!supabase || !confirmDeleteEntry?.id) {
                    setConfirmDeleteEntry(null);
                    return;
                  }
                  await supabase.from('finance_expenses').delete().eq('id', confirmDeleteEntry.id);
                  setEntries((prev) => prev.filter((x) => x.id !== confirmDeleteEntry.id));
                  setConfirmDeleteEntry(null);
                }}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmFinishEntry && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-800">Konfirmasi Selesai</h2>
            </div>
            <div className="p-6 space-y-3">
              <div className="text-sm text-gray-700">
                Tandai pengeluaran ini sebagai selesai?
              </div>
              <div className="text-sm text-gray-600">
                {confirmFinishEntry.date} • {confirmFinishEntry.category} • {confirmFinishEntry.description}
              </div>
              <div className="text-sm font-semibold text-red-600">
                {formatCurrency(confirmFinishEntry.amount)}
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => setConfirmFinishEntry(null)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-gray-700"
              >
                Batal
              </button>
              <button
                onClick={async () => {
                  if (!supabase || !confirmFinishEntry?.id) {
                    setConfirmFinishEntry(null);
                    return;
                  }
                  const { data: updated } = await supabase
                    .from('finance_expenses')
                    .update({ status: 'selesai' })
                    .eq('id', confirmFinishEntry.id)
                    .select('id,status')
                    .single();
                  if (updated) {
                    setEntries((prev) =>
                      prev.map((x) => (x.id === confirmFinishEntry.id ? { ...x, status: 'selesai' } : x))
                    );
                  }
                  setConfirmFinishEntry(null);
                }}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
              >
                Ya, Selesai
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
