import { Search, Wallet, CheckCircle2, XCircle } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

type Medication = { name: string; dose?: string; qty?: number; unit?: string; price?: number };
type RecordItem = {
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
  recordId?: string;
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

interface BillingProps {
  patients: Patient[];
  initialNRM?: string;
  initialRecordIndex?: number;
  onPay?: (nrm: string, recordIndex: number, nextCost: number, nextPaidAmount: number) => void;
}

export default function Billing({ patients, initialNRM, initialRecordIndex, onPay }: BillingProps) {
  const [showDetail, setShowDetail] = useState(false);
  const [detailContext, setDetailContext] = useState<{ patient: Patient; recordIndex: number } | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [procPriceByName, setProcPriceByName] = useState<Record<string, number>>({});
  const [drugPriceByName, setDrugPriceByName] = useState<Record<string, number>>({});
  const [showPay, setShowPay] = useState(false);
  const [payContext, setPayContext] = useState<{ patient: Patient; recordIndex: number } | null>(null);
  const [actionPriceEdit, setActionPriceEdit] = useState<number>(0);
  const [actionPriceStr, setActionPriceStr] = useState<string>('0');
  const [medPriceEdits, setMedPriceEdits] = useState<number[]>([]);
  const [medPriceStrEdits, setMedPriceStrEdits] = useState<string[]>([]);
  const [payNow, setPayNow] = useState<number>(0);
  const [payNowStr, setPayNowStr] = useState<string>('0');
  const [payAuto, setPayAuto] = useState<boolean>(true);

  const resolveActionPrice = useCallback(
    (name: string) => {
      const key = name.toLowerCase();
      return procPriceByName[key] ?? 0;
    },
    [procPriceByName]
  );
  const resolveMedPrice = useCallback(
    (name: string) => {
      const key = name.toLowerCase();
      return drugPriceByName[key] ?? 0;
    },
    [drugPriceByName]
  );
  const computeRecordTotal = useCallback((rec: RecordItem) => {
    const tindakan = resolveActionPrice(rec.action);
    const obat = rec.medications.reduce((sum, m) => {
      const price = m.price ?? resolveMedPrice(m.name) ?? 0;
      const qty = m.qty ?? 0;
      return sum + price * qty;
    }, 0);
    return tindakan + obat;
  }, [resolveActionPrice, resolveMedPrice]);
  const formatCurrency = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;
  const formatNumber = (n: number) => new Intl.NumberFormat('id-ID').format(n);
  const parseNumber = (s: string) => Number((s || '').replace(/[^\d]/g, '') || '0');
  const pad = (n: number) => String(n).padStart(2, '0');
  const toISODate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = toISODate(new Date());

  const bills = useMemo(() => {
    const list: { id: string; date: string; patient: string; poli: string; doctor: string; status: 'Paid' | 'Unpaid'; total: number; paid: number; nrm: string; recordIndex: number }[] = [];
    patients.forEach((p) => {
      p.records.forEach((rec, idx) => {
        if (rec.status === 'cancelled') return;
        const total = rec.cost && rec.cost > 0 ? rec.cost : computeRecordTotal(rec);
        const status = rec.paidAmount >= total && total > 0 ? 'Paid' : 'Unpaid';
        const id = `${p.nrm}-${rec.date.replace(/-/g, '')}-${idx + 1}`;
        list.push({ id, date: rec.date, patient: p.name, poli: rec.poli, doctor: rec.doctor, status, total, paid: rec.paidAmount ?? 0, nrm: p.nrm, recordIndex: idx });
      });
    });
    return list;
  }, [patients, computeRecordTotal]);
  const filteredBills = useMemo(() => {
    return bills.filter((b) => {
      const q = query.trim().toLowerCase();
      const matchesQuery =
        q.length === 0 ||
        b.id.toLowerCase().includes(q) ||
        b.patient.toLowerCase().includes(q) ||
        b.poli.toLowerCase().includes(q) ||
        b.doctor.toLowerCase().includes(q);
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'paid' && b.status === 'Paid') ||
        (statusFilter === 'unpaid' && b.status === 'Unpaid');
      const afterStart = startDate ? b.date >= startDate : true;
      const beforeEnd = endDate ? b.date <= endDate : true;
      return matchesQuery && matchesStatus && afterStart && beforeEnd;
    });
  }, [bills, query, statusFilter, startDate, endDate]);

  const totalToday = bills.reduce((sum, b) => sum + (b.status === 'Paid' && b.date === today ? b.total : 0), 0);
  useEffect(() => {
    if (initialNRM && typeof initialRecordIndex === 'number') {
      const patient = patients.find((p) => p.nrm === initialNRM);
      if (!patient) return;
      if (!patient.records[initialRecordIndex]) return;
      setDetailContext({ patient, recordIndex: initialRecordIndex });
      setShowDetail(true);
    }
  }, [initialNRM, initialRecordIndex, patients]);
  useEffect(() => {
    (async () => {
      if (!supabase) return;
      const { data: procs } = await supabase.from('procedures').select('name,default_cost').is('deleted_at', null);
      const mapP: Record<string, number> = {};
      (procs || []).forEach((r: { name: string; default_cost?: number | null }) => {
        mapP[r.name.toLowerCase()] = Number(r.default_cost ?? 0);
      });
      setProcPriceByName(mapP);
      const { data: drugs } = await supabase.from('drugs').select('name,price').is('deleted_at', null);
      const mapD: Record<string, number> = {};
      (drugs || []).forEach((d: { name: string; price?: number | null }) => {
        mapD[d.name.toLowerCase()] = Number(d.price ?? 0);
      });
      setDrugPriceByName(mapD);
    })();
  }, []);

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Billing</h1>
          <p className="text-gray-600 mt-1">Kelola tagihan dan pembayaran pasien</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-amber-100 rounded-xl flex items-center justify-center">
            <Wallet className="w-7 h-7 text-amber-600" />
          </div>
          <div>
            <p className="text-sm text-gray-600">Total Pembayaran (Hari Ini)</p>
            <p className="text-3xl font-bold text-amber-600">{formatCurrency(totalToday)}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Cari tagihan (nama, invoice, poli)..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'paid' | 'unpaid')}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
          >
            <option value="all">Semua Status</option>
            <option value="paid">Lunas</option>
            <option value="unpaid">Belum Bayar</option>
          </select>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
            />
            <span className="text-gray-500">-</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Invoice</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Tanggal</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Pasien</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Poli</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Dokter</th>
                <th className="text-center py-4 px-6 text-sm font-semibold text-gray-700">Status</th>
                <th className="text-right py-4 px-6 text-sm font-semibold text-gray-700">Total</th>
                <th className="text-right py-4 px-6 text-sm font-semibold text-gray-700">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredBills.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-4 px-6 text-sm text-gray-800 font-medium">{b.id}</td>
                  <td className="py-4 px-6 text-sm text-gray-600">{b.date}</td>
                  <td className="py-4 px-6 text-sm text-gray-800 font-medium">{b.patient}</td>
                  <td className="py-4 px-6 text-sm text-gray-600">{b.poli}</td>
                  <td className="py-4 px-6 text-sm text-gray-600">{b.doctor}</td>
                  <td className="py-4 px-6 text-center">
                    {b.status === 'Paid' ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                        <CheckCircle2 className="w-4 h-4" />
                        Lunas
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                        <XCircle className="w-4 h-4" />
                        Belum Bayar
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-6 text-right text-sm font-semibold text-amber-600">
                    <div className="text-sm font-semibold text-amber-600">{formatCurrency(b.total)}</div>
                    <div className="text-xs font-medium text-emerald-600">{`Paid: ${formatCurrency(b.paid)}`}</div>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <button
                      onClick={() => {
                        const patient = patients.find((p) => p.nrm === b.nrm);
                        if (!patient) return;
                        setDetailContext({ patient, recordIndex: b.recordIndex });
                        setShowDetail(true);
                      }}
                      className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                    >
                      Detail
                    </button>
                    {b.status === 'Unpaid' && (
                      <button
                        onClick={() => {
                          const patient = patients.find((p) => p.nrm === b.nrm);
                          if (!patient) return;
                          const rec = patient.records[b.recordIndex];
                  const prices = rec.medications.map((m) => {
                    const base = (m.price ?? 0) > 0 ? Number(m.price) : resolveMedPrice(m.name);
                    return Number(base ?? 0);
                  });
                  const medsTotal = rec.medications.reduce((sum, m, i) => sum + (prices[i] ?? 0) * (m.qty ?? 0), 0);
                  const baseAction = (rec.cost && rec.cost > 0) ? Math.max(0, Number(rec.cost) - medsTotal) : resolveActionPrice(rec.action);
                  setPayContext({ patient, recordIndex: b.recordIndex });
                  setActionPriceEdit(baseAction);
                  setActionPriceStr(formatNumber(baseAction));
                  setMedPriceEdits(prices);
                  setMedPriceStrEdits(prices.map((p) => formatNumber(p)));
                  const total = baseAction + medsTotal;
                  const paid = rec.paidAmount ?? 0;
                  const due = Math.max(0, total - paid);
                  setPayAuto(true);
                  setPayNow(due);
                  setPayNowStr(formatNumber(due));
                  setShowPay(true);
                        }}
                        className="ml-2 px-3 py-2 bg-amber-50 border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-100 transition-colors text-sm font-medium"
                      >
                        Bayar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showDetail && detailContext && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-800">Detail Tagihan</h2>
            </div>
            <div className="p-6 space-y-4">
              {(() => {
                const { patient, recordIndex } = detailContext;
                const rec = patient.records[recordIndex];
                const computedTotal = rec.cost && rec.cost > 0 ? rec.cost : computeRecordTotal(rec);
                const paid = rec.paidAmount ?? 0;
                return (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Pasien</p>
                        <p className="font-medium text-gray-800">{patient.name}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Dokter</p>
                        <p className="font-medium text-gray-800">{rec.doctor}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Poli</p>
                        <p className="font-medium text-gray-800">{rec.poli}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Tanggal</p>
                        <p className="font-medium text-gray-800">{rec.date}</p>
                      </div>
                    </div>

                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Item</th>
                            <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Harga</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="py-3 px-4 text-sm text-gray-800">{rec.action || 'Tindakan'}</td>
                            <td className="py-3 px-4 text-right text-sm text-gray-800">{formatCurrency(resolveActionPrice(rec.action))}</td>
                          </tr>
                          {rec.medications.map((m, i) => {
                            const price = m.price ?? resolveMedPrice(m.name) ?? 0;
                            const qty = m.qty ?? 0;
                            return (
                              <tr key={i}>
                                <td className="py-3 px-4 text-sm text-gray-800">{`Obat ${m.name}${m.dose ? ` ${m.dose}` : ''}${m.unit ? ` • ${m.unit}` : ''}`}</td>
                                <td className="py-3 px-4 text-right text-sm text-gray-800">{formatCurrency(price * qty)}</td>
                              </tr>
                            );
                          })}
                          <tr className="bg-gray-50">
                            <td className="py-3 px-4 text-sm font-semibold text-gray-800">Total</td>
                            <td className="py-3 px-4 text-right text-sm font-semibold text-amber-600">{formatCurrency(computedTotal)}</td>
                          </tr>
                          <tr>
                            <td className="py-3 px-4 text-sm text-gray-800">Terbayar</td>
                            <td className="py-3 px-4 text-right text-sm text-emerald-700">{formatCurrency(paid)}</td>
                          </tr>
                          <tr>
                            <td className="py-3 px-4 text-sm text-gray-800">Sisa</td>
                            <td className="py-3 px-4 text-right text-sm text-red-700">{formatCurrency(Math.max(0, computedTotal - paid))}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </>
                );
              })()}
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button onClick={() => setShowDetail(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-gray-700">Tutup</button>
              <button
                onClick={() => {
                  if (!detailContext) return;
                  const { patient, recordIndex } = detailContext;
                  const rec = patient.records[recordIndex];
                  const prices = rec.medications.map((m) => {
                    const base = (m.price ?? 0) > 0 ? Number(m.price) : resolveMedPrice(m.name);
                    return Number(base ?? 0);
                  });
                  const medsTotal = rec.medications.reduce((sum, m, i) => sum + (prices[i] ?? 0) * (m.qty ?? 0), 0);
                  const baseAction = (rec.cost && rec.cost > 0) ? Math.max(0, Number(rec.cost) - medsTotal) : resolveActionPrice(rec.action);
                  setPayContext({ patient, recordIndex });
                  setActionPriceEdit(baseAction);
                  setActionPriceStr(formatNumber(baseAction));
                  setMedPriceEdits(prices);
                  setMedPriceStrEdits(prices.map((p) => formatNumber(p)));
                  const total = baseAction + medsTotal;
                  const paid = rec.paidAmount ?? 0;
                  const due = Math.max(0, total - paid);
                  setPayAuto(true);
                  setPayNow(due);
                  setPayNowStr(formatNumber(due));
                  setShowDetail(false);
                  setShowPay(true);
                }}
                className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-medium"
              >
                Form Bayar
              </button>
            </div>
          </div>
        </div>
      )}
      {showPay && payContext && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-800">Pembayaran Tagihan</h2>
            </div>
            <div className="p-6 space-y-4">
              {(() => {
                const { patient, recordIndex } = payContext;
                const rec = patient.records[recordIndex];
                const tindakan = rec.action || 'Tindakan';
                const meds = rec.medications;
                const actionPrice = actionPriceEdit;
                const medLineTotals = meds.map((m, i) => {
                  const unitPrice = medPriceEdits[i] ?? 0;
                  const qty = m.qty ?? 0;
                  return unitPrice * qty;
                });
                const computedTotal = actionPrice + medLineTotals.reduce((a, b) => a + b, 0);
                const paid = rec.paidAmount ?? 0;
                return (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Pasien</p>
                        <p className="font-medium text-gray-800">{patient.name}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Dokter</p>
                        <p className="font-medium text-gray-800">{rec.doctor}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Poli</p>
                        <p className="font-medium text-gray-800">{rec.poli}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Tanggal</p>
                        <p className="font-medium text-gray-800">{rec.date}</p>
                      </div>
                    </div>
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Item</th>
                            <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Harga</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="py-3 px-4 text-sm text-gray-800">{tindakan}</td>
                            <td className="py-3 px-4 text-right text-sm text-gray-800">
                              <input
                                type="text"
                                value={actionPriceStr}
                                onChange={(e) => {
                                  const num = parseNumber(e.target.value);
                                  setActionPriceEdit(num);
                                  setActionPriceStr(formatNumber(num));
                                  if (payAuto) {
                                    const rec = payContext?.patient.records[payContext.recordIndex];
                                    if (rec) {
                                      const total = num + rec.medications.reduce((sum, m, i) => sum + (medPriceEdits[i] ?? 0) * (m.qty ?? 0), 0);
                                      const due = Math.max(0, total - (rec.paidAmount ?? 0));
                                      setPayNow(due);
                                      setPayNowStr(formatNumber(due));
                                    }
                                  }
                                }}
                                className="w-32 px-3 py-1 border border-gray-300 rounded text-right"
                              />
                            </td>
                          </tr>
                          {meds.map((m, i) => (
                            <tr key={`${m.name}-${i}`}>
                              <td className="py-3 px-4 text-sm text-gray-800">{`Obat ${m.name}${m.dose ? ` ${m.dose}` : ''}${m.unit ? ` • ${m.unit}` : ''}`}</td>
                              <td className="py-3 px-4 text-right text-sm text-gray-800">
                                <div className="flex items-center justify-end gap-3">
                                  <span className="text-gray-500">x{m.qty ?? 0}</span>
                                  <input
                                    type="text"
                                    value={medPriceStrEdits[i] ?? '0'}
                                    onChange={(e) => {
                                      const val = parseNumber(e.target.value);
                                      setMedPriceEdits((prev) => {
                                        const next = [...prev];
                                        next[i] = val;
                                        return next;
                                      });
                                      setMedPriceStrEdits((prev) => {
                                        const next = [...prev];
                                        next[i] = formatNumber(val);
                                        return next;
                                      });
                                      if (payAuto) {
                                        const rec = payContext?.patient.records[payContext.recordIndex];
                                        if (rec) {
                                          const total = actionPriceEdit + rec.medications.reduce((sum, m, j) => sum + (j === i ? val : (medPriceEdits[j] ?? 0)) * (m.qty ?? 0), 0);
                                          const due = Math.max(0, total - (rec.paidAmount ?? 0));
                                          setPayNow(due);
                                          setPayNowStr(formatNumber(due));
                                        }
                                      }
                                    }}
                                    className="w-28 px-3 py-1 border border-gray-300 rounded text-right"
                                  />
                                  <span className="font-medium text-amber-600">
                                    {formatCurrency((medPriceEdits[i] ?? 0) * (m.qty ?? 0))}
                                  </span>
                                </div>
                              </td>
                            </tr>
                          ))}
                          <tr className="bg-gray-50">
                            <td className="py-3 px-4 text-sm font-semibold text-gray-800">Total</td>
                            <td className="py-3 px-4 text-right text-sm font-semibold text-amber-600">{formatCurrency(computedTotal)}</td>
                          </tr>
                          <tr>
                            <td className="py-3 px-4 text-sm text-gray-800">Terbayar</td>
                            <td className="py-3 px-4 text-right text-sm text-emerald-700">{formatCurrency(paid)}</td>
                          </tr>
                          <tr>
                            <td className="py-3 px-4 text-sm text-gray-800">Bayar Sekarang</td>
                            <td className="py-3 px-4 text-right text-sm">
                              <input
                                type="text"
                                value={payNowStr}
                                onChange={(e) => {
                                  const num = parseNumber(e.target.value);
                                  setPayNow(num);
                                  setPayNowStr(formatNumber(num));
                                  setPayAuto(false);
                                }}
                                className="w-32 px-3 py-1 border border-gray-300 rounded text-right"
                              />
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </>
                );
              })()}
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => { setShowPay(false); setPayContext(null); }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-gray-700"
              >
                Tutup
              </button>
              <button
                onClick={async () => {
                  if (!payContext) return;
                  const { patient, recordIndex } = payContext;
                  const rec = patient.records[recordIndex];
                  const total = actionPriceEdit + rec.medications.reduce((sum, m, i) => sum + (medPriceEdits[i] ?? 0) * (m.qty ?? 0), 0);
                  const addPaid = Math.max(0, payNow);
                  const nextPaid = (rec.paidAmount ?? 0) + addPaid;
                  if (supabase) {
                    try {
                      const { data: pRow } = await supabase
                        .from('patients')
                        .select('id')
                        .eq('nrm', patient.nrm)
                        .limit(1)
                        .maybeSingle();
                      const patientId = pRow?.id ?? null;
                      let recordId = rec.recordId || null;
                      if (!recordId && patientId) {
                        const { data: recRow } = await supabase
                          .from('medical_records')
                          .select('id')
                          .eq('patient_id', patientId)
                          .eq('date', rec.date)
                          .order('updated_at', { ascending: false })
                          .limit(1)
                          .maybeSingle();
                        recordId = recRow?.id ?? null;
                      }
                      if (recordId) {
                        const names = rec.medications.map((m) => m.name);
                        const { data: existingDrugs } = await supabase
                          .from('drugs')
                          .select('id,name')
                          .in('name', names);
                        const mapId = new Map<string, string>();
                        (existingDrugs || []).forEach((d: { id: string; name: string }) => mapId.set(d.name, d.id));
                        const { data: mrmRows } = await supabase
                          .from('medical_record_medications')
                          .select('id,drug_id')
                          .eq('record_id', recordId);
                        const byDrug = new Map<string, string>();
                        (mrmRows || []).forEach((r: { id: string; drug_id?: string | null }) => { if (r.drug_id) byDrug.set(r.drug_id, r.id); });
                        for (let i = 0; i < rec.medications.length; i++) {
                          const m = rec.medications[i];
                          const price = medPriceEdits[i] ?? 0;
                          const drugId = mapId.get(m.name);
                          if (!drugId) continue;
                          const rowId = byDrug.get(drugId);
                          if (rowId) {
                            await supabase
                              .from('medical_record_medications')
                              .update({ price })
                              .eq('id', rowId);
                          }
                        }
                      }
                    } catch (err) {
                      console.error('Supabase error', err);
                    }
                  }
                  onPay?.(patient.nrm, recordIndex, total, nextPaid);
                  setShowPay(false);
                  setPayContext(null);
                }}
                className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-medium"
              >
                Bayar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
