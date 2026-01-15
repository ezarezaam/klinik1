import { Wallet, Search, Calendar, Eye, Pencil, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

type Medication = { name: string; dose?: string; qty?: number; unit?: string; price?: number };
type RecordItem = {
  recordId?: string;
  date: string;
  poli: string;
  doctor: string;
  diagnosis: string;
  action: string;
  complaint?: string;
  medications: Medication[];
  status: 'completed' | 'in_progress' | 'cancelled';
  cost: number;
  paidAmount: number;
};
type Patient = {
  id: number;
  name: string;
  nrm: string;
  poli: string;
  birthDate: string;
  address: string;
  phone: string;
  email: string;
  parentName: string;
  parentPhone: string;
  parentEmail: string;
  records: RecordItem[];
};

type IncomeEntry = {
  id?: string;
  date: string;
  category: 'Tindakan' | 'Resep/Obat' | 'Lainnya';
  description: string;
  patient?: string;
  poli?: string;
  doctor?: string;
  amount: number;
  source?: 'invoice' | 'manual' | 'local';
  recordId?: string;
};

interface FinanceIncomeProps {
  patients: Patient[];
}

export default function FinanceIncome(props: FinanceIncomeProps) {
  void props;
  const [query, setQuery] = useState('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [showAdd, setShowAdd] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [detailEntry, setDetailEntry] = useState<IncomeEntry | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteEntry, setConfirmDeleteEntry] = useState<IncomeEntry | null>(null);
  const [addDate, setAddDate] = useState<string>('');
  const [addCategory, setAddCategory] = useState<IncomeEntry['category']>('Lainnya');
  const [addDescription, setAddDescription] = useState<string>('');
  const [addAmount, setAddAmount] = useState<number>(0);
  const [addAmountStr, setAddAmountStr] = useState<string>('');
  const [addDateErr, setAddDateErr] = useState<boolean>(false);
  const [addDescErr, setAddDescErr] = useState<boolean>(false);
  const [addAmountErr, setAddAmountErr] = useState<boolean>(false);
  const [extraEntries, setExtraEntries] = useState<IncomeEntry[]>([]);
  const [dbEntries, setDbEntries] = useState<IncomeEntry[]>([]);
  const formatCurrency = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

  const [patientNameById, setPatientNameById] = useState<Map<string, string>>(new Map());
  const [invoiceRows, setInvoiceRows] = useState<{ id: string; patient_id: string; medical_record_id?: string | null; paid_amount?: number | null; issued_at?: string | null; updated_at?: string | null }[]>([]);
  const recordInfoById = useMemo(() => {
    const map = new Map<string, { patient: string; poli: string; doctor: string; medications: Medication[]; action: string; cost: number; paidAmount: number }>();
    props.patients.forEach((p) => {
      p.records.forEach((r) => {
        const rid = r.recordId as string | undefined;
        if (rid) {
          map.set(rid, {
            patient: p.name,
            poli: r.poli,
            doctor: r.doctor,
            medications: r.medications,
            action: r.action,
            cost: r.cost,
            paidAmount: r.paidAmount,
          });
        }
      });
    });
    return map;
  }, [props.patients]);
  useEffect(() => {
    (async () => {
      if (!supabase) return;
      const { data: pat } = await supabase.from('patients').select('id,name').is('deleted_at', null);
      const mp = new Map<string, string>();
      (pat || []).forEach((p: { id: string; name: string }) => mp.set(p.id, p.name));
      setPatientNameById(mp);
      const { data: inv } = await supabase
        .from('invoices')
        .select('id,patient_id,medical_record_id,paid_amount,issued_at,updated_at')
        .is('deleted_at', null)
        .order('issued_at', { ascending: false });
      setInvoiceRows((inv || []) as { id: string; patient_id: string; medical_record_id?: string | null; paid_amount?: number | null; issued_at?: string | null; updated_at?: string | null }[]);
    })();
  }, []);
  useEffect(() => {
    if (!supabase) return;
    const ch = supabase
      .channel('realtime-invoices')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, async () => {
        if (!supabase) return;
        const { data: inv } = await supabase
          .from('invoices')
          .select('id,patient_id,medical_record_id,paid_amount,issued_at,updated_at')
          .is('deleted_at', null)
          .order('issued_at', { ascending: false });
        setInvoiceRows((inv || []) as { id: string; patient_id: string; medical_record_id?: string | null; paid_amount?: number | null; issued_at?: string | null; updated_at?: string | null }[]);
      })
      .subscribe();
    return () => {
      if (supabase) supabase.removeChannel(ch);
    };
  }, []);
  const invoiceEntries: IncomeEntry[] = useMemo(() => {
    return invoiceRows.map((r) => {
      const d = (r.issued_at || r.updated_at || '').slice(0, 10);
      const recInfo = r.medical_record_id ? recordInfoById.get(r.medical_record_id) : undefined;
      return {
        id: r.id,
        date: d,
        category: 'Lainnya',
        description: 'Billing Rekam Medis',
        patient: recInfo?.patient || patientNameById.get(r.patient_id),
        poli: recInfo?.poli,
        doctor: recInfo?.doctor,
        amount: Number(r.paid_amount ?? 0),
        source: 'invoice',
        recordId: r.medical_record_id || undefined,
      };
    });
  }, [invoiceRows, patientNameById, recordInfoById]);
  

  const fetchIncomes = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from('finance_incomes')
      .select('id,date,description,amount,updated_at')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false });
    if (!data) return;
    type IncomeRow = { id: string; date: string; description: string; amount?: number | null };
    const mapped: IncomeEntry[] = (data as IncomeRow[])
      .filter((r) => !(r.description || '').toLowerCase().startsWith('pembayaran pasien'))
      .map((r) => ({
        id: r.id,
        date: r.date,
        category: 'Lainnya',
        description: r.description,
        amount: Number(r.amount ?? 0),
        source: 'manual',
      }));
    setDbEntries(mapped);
  }, []);
  useEffect(() => {
    fetchIncomes();
    return () => {
    };
  }, [fetchIncomes]);
  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel('realtime-finance-incomes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'finance_incomes' }, () => {
        fetchIncomes();
      })
      .subscribe();
    return () => {
      if (supabase) supabase.removeChannel(channel);
    };
  }, [fetchIncomes]);
  const mergedEntries = useMemo(() => {
    return [...invoiceEntries, ...dbEntries, ...extraEntries];
  }, [invoiceEntries, dbEntries, extraEntries]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return mergedEntries.filter((e) => {
      const matchesQuery =
        q.length === 0 ||
        e.description.toLowerCase().includes(q) ||
        (e.patient || '').toLowerCase().includes(q) ||
        (e.poli || '').toLowerCase().includes(q) ||
        (e.doctor || '').toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q);
      const afterStart = startDate ? e.date >= startDate : true;
      const beforeEnd = endDate ? e.date <= endDate : true;
      return matchesQuery && afterStart && beforeEnd;
    });
  }, [mergedEntries, query, startDate, endDate]);
  const total = filtered.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Pemasukan</h1>
          <p className="text-gray-600 mt-1">Pemasukan dari tindakan dan resep/penjualan obat</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-emerald-100 rounded-xl flex items-center justify-center">
            <Wallet className="w-7 h-7 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm text-gray-600">Total Pemasukan (filter saat ini)</p>
            <p className="text-3xl font-bold text-emerald-600">{formatCurrency(total)}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Cari pemasukan (pasien, poli, dokter, kategori)..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
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
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
            <span className="text-gray-500">-</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
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
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Pasien</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Poli</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Dokter</th>
                <th className="text-right py-4 px-6 text-sm font-semibold text-gray-700">Jumlah</th>
                <th className="text-center py-4 px-6 text-sm font-semibold text-gray-700">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((e, idx) => (
                <tr key={`${e.date}-${e.description}-${idx}`} className="hover:bg-gray-50 transition-colors">
                  <td className="py-4 px-6 text-sm text-gray-600">{e.date}</td>
                  <td className="py-4 px-6 text-sm text-gray-800 font-medium">{e.category}</td>
                  <td className="py-4 px-6 text-sm text-gray-600">{e.description}</td>
                  <td className="py-4 px-6 text-sm text-gray-600">{e.patient || '-'}</td>
                  <td className="py-4 px-6 text-sm text-gray-600">{e.poli || '-'}</td>
                  <td className="py-4 px-6 text-sm text-gray-600">{e.doctor || '-'}</td>
                  <td className="py-4 px-6 text-right text-sm font-semibold text-emerald-600">{formatCurrency(e.amount)}</td>
                  <td className="py-4 px-6 text-center">
                    <div className="inline-flex items-center gap-3">
                      <button
                        type="button"
                        className="text-gray-600 hover:text-gray-800"
                        onClick={() => { setDetailEntry(e); setShowDetail(true); }}
                        title="Detail"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                      {e.source !== 'invoice' && (
                        <>
                          <button
                            type="button"
                            className="text-emerald-600 hover:text-emerald-700"
                            onClick={() => {
                              setEditingId(e.id || null);
                              setAddDate(e.date);
                              setAddCategory(e.category);
                              setAddDescription(e.description);
                              setAddAmount(e.amount);
                              setAddAmountStr(e.amount > 0 ? new Intl.NumberFormat('id-ID').format(e.amount) : '');
                              setShowAdd(true);
                            }}
                            title="Edit"
                          >
                            <Pencil className="w-5 h-5" />
                          </button>
                          <button
                            type="button"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => { setConfirmDeleteEntry(e); }}
                            title="Hapus"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </>
                      )}
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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-800">{editingId ? 'Edit Pemasukan' : 'Tambah Pemasukan'}</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tanggal</label>
                <input
                  type="date"
                  value={addDate}
                  onChange={(e) => {
                    setAddDate(e.target.value);
                    if (e.target.value) setAddDateErr(false);
                  }}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 outline-none ${addDateErr ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-emerald-500 focus:border-emerald-500'}`}
                />
                {addDateErr && <div className="text-xs text-red-600 mt-1">Wajib diisi</div>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Kategori</label>
                <select
                  value={addCategory}
                  onChange={(e) => setAddCategory(e.target.value as IncomeEntry['category'])}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                >
                  <option value="Tindakan">Tindakan</option>
                  <option value="Resep/Obat">Resep/Obat</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
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
                  placeholder="Keterangan pemasukan"
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 outline-none ${addDescErr ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-emerald-500 focus:border-emerald-500'}`}
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
                    placeholder="0"
                    className={`w-full pl-12 pr-4 py-2 border rounded-lg focus:ring-2 outline-none ${addAmountErr ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-emerald-500 focus:border-emerald-500'}`}
                  />
                </div>
                {addAmountErr && <div className="text-xs text-red-600 mt-1">Wajib diisi</div>}
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button onClick={() => setShowAdd(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-gray-700">Batal</button>
              <button
                onClick={async () => {
                  const hasErr = !addDate || !addDescription.trim() || addAmount <= 0;
                  setAddDateErr(!addDate);
                  setAddDescErr(!addDescription.trim());
                  setAddAmountErr(!(addAmount > 0));
                  if (hasErr) return;
                  if (supabase) {
                    if (editingId) {
                      const { data: updated, error: eUpd } = await supabase
                        .from('finance_incomes')
                        .update({ date: addDate, description: addDescription, amount: addAmount })
                        .eq('id', editingId)
                        .select()
                        .single();
                      if (!eUpd && updated) {
                        setDbEntries((prev) =>
                          prev.map((en) =>
                            en.id === editingId
                              ? { id: updated.id, date: updated.date, category: 'Lainnya', description: updated.description, amount: Number(updated.amount ?? 0) }
                              : en
                          )
                        );
                      }
                    } else {
                      const { data: ins, error } = await supabase
                        .from('finance_incomes')
                        .insert({ date: addDate, description: addDescription, amount: addAmount })
                        .select()
                        .single();
                      if (!error && ins) {
                        setDbEntries((prev) => [
                          ...prev,
                          { id: ins.id, date: addDate, category: addCategory, description: addDescription, amount: addAmount },
                        ]);
                      }
                    }
                  } else {
                    if (editingId) {
                      setDbEntries((prev) =>
                        prev.map((en) =>
                          en.id === editingId ? { ...en, date: addDate, category: addCategory, description: addDescription, amount: addAmount } : en
                        )
                      );
                    } else {
                      setExtraEntries((prev) => [
                        ...prev,
                        { date: addDate, category: addCategory, description: addDescription, amount: addAmount },
                      ]);
                    }
                  }
                  setShowAdd(false);
                  setEditingId(null);
                  setAddAmount(0);
                  setAddAmountStr('');
                  setAddDateErr(false);
                  setAddDescErr(false);
                  setAddAmountErr(false);
                }}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
      {showDetail && detailEntry && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-800">Detail Pemasukan</h2>
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
                <span className="text-gray-600">Pasien</span>
                <span className="text-gray-800 font-medium">{detailEntry.patient || '-'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Poli</span>
                <span className="text-gray-800 font-medium">{detailEntry.poli || '-'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Dokter</span>
                <span className="text-gray-800 font-medium">{detailEntry.doctor || '-'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Jumlah</span>
                <span className="text-emerald-600 font-semibold">{formatCurrency(detailEntry.amount)}</span>
              </div>
              {detailEntry.source === 'invoice' && detailEntry.recordId && (() => {
                const rec = recordInfoById.get(detailEntry.recordId!);
                if (!rec) return null;
                const medLineTotals = rec.medications.map((m) => (m.price ?? 0) * (m.qty ?? 0));
                const tindakanPrice = Math.max(0, rec.cost - medLineTotals.reduce((a, b) => a + b, 0));
                return (
                  <div className="mt-4">
                    <div className="text-sm font-semibold text-gray-700 mb-2">Rincian</div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="text-left py-2 px-4 text-sm font-semibold text-gray-700">Jenis</th>
                            <th className="text-left py-2 px-4 text-sm font-semibold text-gray-700">Nama</th>
                            <th className="text-left py-2 px-4 text-sm font-semibold text-gray-700">Dosis</th>
                            <th className="text-left py-2 px-4 text-sm font-semibold text-gray-700">Qty</th>
                            <th className="text-left py-2 px-4 text-sm font-semibold text-gray-700">Unit</th>
                            <th className="text-right py-2 px-4 text-sm font-semibold text-gray-700">Harga</th>
                            <th className="text-right py-2 px-4 text-sm font-semibold text-gray-700">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          <tr>
                            <td className="py-2 px-4 text-sm text-gray-700">Tindakan</td>
                            <td className="py-2 px-4 text-sm text-gray-800 font-medium">{rec.action || '-'}</td>
                            <td className="py-2 px-4 text-sm text-gray-600">-</td>
                            <td className="py-2 px-4 text-sm text-gray-600">-</td>
                            <td className="py-2 px-4 text-sm text-gray-600">-</td>
                            <td className="py-2 px-4 text-right text-sm text-gray-800">{formatCurrency(tindakanPrice)}</td>
                            <td className="py-2 px-4 text-right text-sm font-semibold text-gray-900">{formatCurrency(tindakanPrice)}</td>
                          </tr>
                          {rec.medications.filter((m) => (m.qty ?? 0) > 0).map((m, i) => {
                            const unitPrice = m.price ?? 0;
                            const subtotal = unitPrice * (m.qty ?? 0);
                            return (
                              <tr key={`${m.name}-${i}`}>
                                <td className="py-2 px-4 text-sm text-gray-700">Obat</td>
                                <td className="py-2 px-4 text-sm text-gray-800 font-medium">{m.name}</td>
                                <td className="py-2 px-4 text-sm text-gray-600">{m.dose || '-'}</td>
                                <td className="py-2 px-4 text-sm text-gray-600">{m.qty ?? 0}</td>
                                <td className="py-2 px-4 text-sm text-gray-600">{m.unit || '-'}</td>
                                <td className="py-2 px-4 text-right text-sm text-gray-800">{formatCurrency(unitPrice)}</td>
                                <td className="py-2 px-4 text-right text-sm font-semibold text-gray-900">{formatCurrency(subtotal)}</td>
                              </tr>
                            );
                          })}
                          <tr>
                            <td className="py-2 px-4 text-sm text-gray-700" colSpan={6}>Total Biaya Rekam Medis</td>
                            <td className="py-2 px-4 text-right text-sm font-bold text-gray-900">{formatCurrency(rec.cost)}</td>
                          </tr>
                          <tr>
                            <td className="py-2 px-4 text-sm text-gray-700" colSpan={6}>Total Dibayar (Invoice)</td>
                            <td className="py-2 px-4 text-right text-sm font-bold text-emerald-700">{formatCurrency(detailEntry.amount)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}
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
                Apakah Anda yakin ingin menghapus pemasukan ini?
              </div>
              <div className="text-sm text-gray-600">
                {confirmDeleteEntry.date} • {confirmDeleteEntry.category} • {confirmDeleteEntry.description}
              </div>
              <div className="text-sm font-semibold text-emerald-600">
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
                  await supabase.from('finance_incomes').update({ deleted_at: new Date().toISOString() }).eq('id', confirmDeleteEntry.id);
                  setDbEntries((prev) => prev.filter((x) => x.id !== confirmDeleteEntry.id));
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
    </div>
  );
}
