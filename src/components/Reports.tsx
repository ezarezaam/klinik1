import { FileText, Download, Calendar, Users, Stethoscope, Pill } from 'lucide-react';
import { useEffect, useCallback, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function Reports() {
  const today = new Date();
  const defaultEnd = today.toISOString().slice(0, 10);
  const defaultStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30).toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [loading, setLoading] = useState(false);

  const [summary, setSummary] = useState<{ visits: number; completed: number; prescriptions: number; billingTotal: number }>({
    visits: 0,
    completed: 0,
    prescriptions: 0,
    billingTotal: 0,
  });

  const [incomeByCategory, setIncomeByCategory] = useState<{ category: string; amount: number; percentage: number }[]>([]);

  const [expenseByCategory, setExpenseByCategory] = useState<{ category: string; amount: number; percentage: number }[]>([]);
  const [topDiagnoses, setTopDiagnoses] = useState<{ name: string; count: number }[]>([]);
  const [topProcedures, setTopProcedures] = useState<{ name: string; count: number }[]>([]);

  const fetchReport = useCallback(async () => {
    if (!supabase || !startDate || !endDate) return;
    setLoading(true);
    try {
      const { data: records } = await supabase
        .from('medical_records')
        .select('id,date,status,cost,diagnosis,action')
        .is('deleted_at', null)
        .gte('date', startDate)
        .lte('date', endDate);
      const recList = (records || []) as { id: string; date: string; status?: string | null; cost?: number | null; diagnosis?: string | null; action?: string | null }[];
      const recordIds = recList.map((r) => r.id);
      const { data: meds } = recordIds.length
        ? await supabase.from('medical_record_medications').select('record_id,qty,price').in('record_id', recordIds)
        : { data: [] as { record_id: string; qty?: number | null; price?: number | null }[] };
      const medsList = (meds || []) as { record_id: string; qty?: number | null; price?: number | null }[];
      const visits = recList.length;
      const completed = recList.filter((r) => (r.status ?? '') === 'completed').length;
      const billingTotal = recList.reduce((sum, r) => sum + Number(r.cost ?? 0), 0);
      const prescriptions = medsList.length;
      setSummary({ visits, completed, prescriptions, billingTotal });
      const medsTotal = medsList.reduce((sum, m) => sum + Number(m.price ?? 0) * Number(m.qty ?? 0), 0);
      const tindakanTotal = Math.max(0, billingTotal - medsTotal);
      const totalIncome = medsTotal + tindakanTotal;
      const incomeCat = [
        { category: 'Tindakan', amount: tindakanTotal },
        { category: 'Resep/Obat', amount: medsTotal },
      ].map((it) => ({ ...it, percentage: totalIncome > 0 ? (it.amount / totalIncome) * 100 : 0 }));
      setIncomeByCategory(incomeCat);
      const { data: expenses } = await supabase
        .from('finance_expenses')
        .select('category_name,amount,date,status')
        .is('deleted_at', null)
        .eq('status', 'selesai')
        .gte('date', startDate)
        .lte('date', endDate);
      const expList = (expenses || []) as { category_name?: string | null; amount?: number | null; date: string }[];
      const expMap = new Map<string, number>();
      expList.forEach((e) => {
        const cat = (e.category_name || 'Lainnya') as string;
        const cur = expMap.get(cat) ?? 0;
        expMap.set(cat, cur + Number(e.amount ?? 0));
      });
      const expTotal = Array.from(expMap.values()).reduce((sum, v) => sum + v, 0);
      setExpenseByCategory(Array.from(expMap.entries()).map(([category, amount]) => ({ category, amount, percentage: expTotal > 0 ? (amount / expTotal) * 100 : 0 })));
      const diagMap = new Map<string, number>();
      const procMap = new Map<string, number>();
      recList.forEach((r) => {
        const d = (r.diagnosis || '').trim();
        if (d) diagMap.set(d, (diagMap.get(d) ?? 0) + 1);
        const a = (r.action || '').trim();
        if (a && a !== '-') procMap.set(a, (procMap.get(a) ?? 0) + 1);
      });
      setTopDiagnoses(
        Array.from(diagMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, count]) => ({ name, count }))
      );
      setTopProcedures(
        Array.from(procMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, count]) => ({ name, count }))
      );
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Laporan Klinik</h1>
        <p className="text-gray-600 mt-1">Ringkasan operasional klinik</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tanggal Mulai
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              />
            </div>
          </div>

          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tanggal Akhir
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              />
            </div>
          </div>

          <button
            onClick={fetchReport}
            className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-2 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={loading}
          >
            <FileText className="w-5 h-5" />
            <span className="font-medium">{loading ? 'Memuat...' : 'Tampilkan Laporan'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center mb-4">
            <Users className="w-6 h-6 text-emerald-600" />
          </div>
          <p className="text-sm text-gray-600 mb-1">Total Kunjungan</p>
          <p className="text-2xl font-bold text-emerald-600">{new Intl.NumberFormat('id-ID').format(summary.visits)}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
            <Stethoscope className="w-6 h-6 text-blue-600" />
          </div>
          <p className="text-sm text-gray-600 mb-1">Pemeriksaan Selesai</p>
          <p className="text-2xl font-bold text-blue-600">{new Intl.NumberFormat('id-ID').format(summary.completed)}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
            <Pill className="w-6 h-6 text-purple-600" />
          </div>
          <p className="text-sm text-gray-600 mb-1">Resep Dikeluarkan</p>
          <p className="text-2xl font-bold text-purple-600">{new Intl.NumberFormat('id-ID').format(summary.prescriptions)}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center mb-4">
            <FileText className="w-6 h-6 text-amber-600" />
          </div>
          <p className="text-sm text-gray-600 mb-1">Total Billing</p>
          <p className="text-2xl font-bold text-amber-600">Rp {new Intl.NumberFormat('id-ID').format(summary.billingTotal)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-6">Pemasukan per Kategori</h2>
          <div className="space-y-4">
            {incomeByCategory.map((item) => (
              <div key={item.category}>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">{item.category}</span>
                  <span className="text-sm font-semibold text-emerald-600">
                    Rp {item.amount.toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-emerald-500 h-2 rounded-full transition-all"
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">{item.percentage.toFixed(1)}% dari total</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-6">Pengeluaran per Kategori</h2>
          <div className="space-y-4">
            {expenseByCategory.map((item) => (
              <div key={item.category}>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">{item.category}</span>
                  <span className="text-sm font-semibold text-red-600">
                    Rp {item.amount.toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-red-500 h-2 rounded-full transition-all"
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">{item.percentage.toFixed(1)}% dari total</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-800">Ringkasan Operasional</h2>
          <button className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors">
            <Download className="w-5 h-5" />
            <span className="font-medium">Export PDF</span>
          </button>
        </div>

        <div className="border border-gray-200 rounded-lg p-6">
          <div className="text-center mb-6">
            <h3 className="text-2xl font-bold text-gray-800">RINGKASAN KLINIK</h3>
            <p className="text-gray-600 mt-2">Periode: {startDate} s/d {endDate}</p>
            <p className="text-gray-600">Klinik</p>
          </div>

          <div className="space-y-6">
            <div>
              <h4 className="font-bold text-gray-800 mb-3 pb-2 border-b border-gray-300">TOP DIAGNOSA</h4>
              {topDiagnoses.map((item) => (
                <div key={item.name} className="flex justify-between py-2">
                  <span className="text-gray-700">{item.name}</span>
                  <span className="font-medium text-gray-800">{item.count.toLocaleString('id-ID')} kasus</span>
                </div>
              ))}
              <div className="flex justify-between py-2 mt-2 pt-2 border-t border-gray-300 font-bold">
                <span className="text-gray-800">Total Kunjungan</span>
                <span className="text-emerald-600">{new Intl.NumberFormat('id-ID').format(summary.visits)}</span>
              </div>
            </div>

            <div>
              <h4 className="font-bold text-gray-800 mb-3 pb-2 border-b border-gray-300">TOP TINDAKAN</h4>
              {topProcedures.map((item) => (
                <div key={item.name} className="flex justify-between py-2">
                  <span className="text-gray-700">{item.name}</span>
                  <span className="font-medium text-gray-800">{item.count.toLocaleString('id-ID')} kali</span>
                </div>
              ))}
              <div className="flex justify-between py-2 mt-2 pt-2 border-t border-gray-300 font-bold">
                <span className="text-gray-800">Pemeriksaan Selesai</span>
                <span className="text-blue-600">{new Intl.NumberFormat('id-ID').format(summary.completed)}</span>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold text-gray-800">TOTAL BILLING</span>
                <span className="text-2xl font-bold text-amber-600">Rp {new Intl.NumberFormat('id-ID').format(summary.billingTotal)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
