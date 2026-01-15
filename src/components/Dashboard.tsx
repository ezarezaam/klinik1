import { Users, Stethoscope, Pill, Wallet, Calendar } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

const MONTH_NAMES_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

export default function Dashboard() {
  const [totalPatients, setTotalPatients] = useState<number>(0);
  const [activeDoctors, setActiveDoctors] = useState<number>(0);
  const [activeDrugs, setActiveDrugs] = useState<number>(0);
  const [todayTransactions, setTodayTransactions] = useState<number>(0);
  const stats = useMemo(
    () => [
      { label: 'Total Pasien', value: totalPatients, icon: Users, color: 'bg-emerald-500' },
      { label: 'Dokter Aktif', value: activeDoctors, icon: Stethoscope, color: 'bg-blue-500' },
      { label: 'Obat Terdaftar', value: activeDrugs, icon: Pill, color: 'bg-purple-500' },
      { label: 'Transaksi Hari Ini', value: todayTransactions, icon: Wallet, color: 'bg-amber-500' },
    ],
    [totalPatients, activeDoctors, activeDrugs, todayTransactions]
  );

  const [recentVisits, setRecentVisits] = useState<
    { id: string; date: string; patient: string; poli: string; doctor: string; status: string; billing: number }[]
  >([]);

  const [todayVisits, setTodayVisits] = useState<number>(0);
  const [todayPrescriptions, setTodayPrescriptions] = useState<number>(0);
  const [todayCompletedBills, setTodayCompletedBills] = useState<number>(0);

  const [monthLabels, setMonthLabels] = useState<string[]>([]);
  const [monthlyVisits, setMonthlyVisits] = useState<number[]>([]);
  const [monthlyBills, setMonthlyBills] = useState<number[]>([]);

  const formatCurrency = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;
  const today = new Date();
  const headerDate = `${today.getDate()} ${MONTH_NAMES_ID[today.getMonth()]} ${today.getFullYear()}`;

  useEffect(() => {
    let active = true;
    (async () => {
      if (!supabase) return;
      const dateStr = new Date().toISOString().slice(0, 10);
      const [{ count: patientCount }, { count: doctorCount }, { count: drugCount }, { count: incomeToday }, { count: expenseToday }] =
        await Promise.all([
          supabase.from('patients').select('id', { count: 'exact', head: true }).is('deleted_at', null),
          supabase.from('doctors').select('id', { count: 'exact', head: true }).eq('active', true).is('deleted_at', null),
          supabase.from('drugs').select('id', { count: 'exact', head: true }).eq('active', true).is('deleted_at', null),
          supabase.from('finance_incomes').select('*', { count: 'exact', head: true }).eq('date', dateStr).is('deleted_at', null),
          supabase.from('finance_expenses').select('*', { count: 'exact', head: true }).eq('date', dateStr).is('deleted_at', null),
        ]);
      if (!active) return;
      setTotalPatients(Number(patientCount ?? 0));
      setActiveDoctors(Number(doctorCount ?? 0));
      setActiveDrugs(Number(drugCount ?? 0));
      setTodayTransactions(Number(incomeToday ?? 0) + Number(expenseToday ?? 0));
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!supabase) return;
      const dateStr = new Date().toISOString().slice(0, 10);
      const { data: recent } = await supabase
        .from('medical_records')
        .select('id,date,patient_id,poli_id,doctor_id,status,cost')
        .is('deleted_at', null)
        .order('date', { ascending: false })
        .limit(10);
      const { data: todayRecords } = await supabase
        .from('medical_records')
        .select('id,date,status,cost')
        .eq('date', dateStr)
        .is('deleted_at', null);
      const recIds = (todayRecords || []).map((r: { id: string }) => r.id);
      const { data: mrms } = recIds.length
        ? await supabase.from('medical_record_medications').select('record_id').in('record_id', recIds)
        : { data: [] as { record_id: string }[] };
      if (!active) return;
      setTodayVisits((todayRecords || []).length);
      setTodayPrescriptions((mrms || []).length);
      setTodayCompletedBills((todayRecords || []).filter((r: { status?: string | null }) => (r.status ?? '') === 'completed').length);
      const pids = Array.from(new Set((recent || []).map((r: { patient_id?: string | null }) => r.patient_id).filter(Boolean))) as string[];
      const dids = Array.from(new Set((recent || []).map((r: { doctor_id?: string | null }) => r.doctor_id).filter(Boolean))) as string[];
      const polids = Array.from(new Set((recent || []).map((r: { poli_id?: string | null }) => r.poli_id).filter(Boolean))) as string[];
      const [{ data: patients }, { data: doctors }, { data: polies }] = await Promise.all([
        pids.length ? supabase.from('patients').select('id,name').in('id', pids) : { data: [] as { id: string; name: string }[] },
        dids.length ? supabase.from('doctors').select('id,name').in('id', dids) : { data: [] as { id: string; name: string }[] },
        polids.length ? supabase.from('polies').select('id,name').in('id', polids) : { data: [] as { id: string; name: string }[] },
      ]);
      const mapP = new Map<string, string>();
      const mapD = new Map<string, string>();
      const mapPol = new Map<string, string>();
      (patients || []).forEach((p: { id: string; name: string }) => mapP.set(p.id, p.name));
      (doctors || []).forEach((d: { id: string; name: string }) => mapD.set(d.id, d.name));
      (polies || []).forEach((p: { id: string; name: string }) => mapPol.set(p.id, p.name));
      setRecentVisits(
        (recent || []).map(
          (r: { id: string; date: string; patient_id?: string | null; poli_id?: string | null; doctor_id?: string | null; status?: string | null; cost?: number | null }) => ({
            id: r.id,
            date: r.date,
            patient: (r.patient_id && mapP.get(r.patient_id)) || '-',
            poli: (r.poli_id && mapPol.get(r.poli_id)) || '-',
            doctor: (r.doctor_id && mapD.get(r.doctor_id)) || '-',
            status: (r.status ?? 'in_progress') === 'completed' ? 'Selesai' : (r.status ?? 'in_progress') === 'in_progress' ? 'Pemeriksaan' : 'Dibatalkan',
            billing: Number(r.cost ?? 0),
          })
        )
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
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      const startStr = start.toISOString().slice(0, 10);
      const { data } = await supabase
        .from('medical_records')
        .select('date,cost')
        .is('deleted_at', null)
        .gte('date', startStr);
      if (!active) return;
      const keys: string[] = [];
      const labels: string[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        keys.push(key);
        labels.push(MONTH_NAMES_ID[d.getMonth()].slice(0, 3));
      }
      const byKey = new Map<string, { visits: number; bills: number }>();
      keys.forEach((k) => byKey.set(k, { visits: 0, bills: 0 }));
      (data || []).forEach((r: { date: string; cost?: number | null }) => {
        const k = r.date.slice(0, 7);
        if (byKey.has(k)) {
          const cur = byKey.get(k)!;
          cur.visits += 1;
          cur.bills += Number(r.cost ?? 0);
        }
      });
      setMonthLabels(labels);
      setMonthlyVisits(keys.map((k) => byKey.get(k)?.visits ?? 0));
      setMonthlyBills(keys.map((k) => byKey.get(k)?.bills ?? 0));
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Dashboard</h1>
        <p className="text-gray-600 mt-1 flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          <span>{headerDate}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className={`${stat.color} w-12 h-12 rounded-lg flex items-center justify-center`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-1">{stat.label}</p>
              <p className="text-2xl font-bold text-gray-800">{new Intl.NumberFormat('id-ID').format(Number(stat.value || 0))}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-800">Statistik Kunjungan</h2>
            <select className="px-4 py-2 border border-gray-200 rounded-lg text-sm">
              <option>6 Bulan Terakhir</option>
              <option>3 Bulan Terakhir</option>
              <option>1 Tahun</option>
            </select>
          </div>
          <div className="h-64 flex items-end justify-around gap-4">
            {monthLabels.map((month, i) => {
              const maxVisits = Math.max(...monthlyVisits, 1);
              const maxBills = Math.max(...monthlyBills, 1);
              const visitsHeight = Math.round(((monthlyVisits[i] || 0) / maxVisits) * 100);
              const billsHeight = Math.round(((monthlyBills[i] || 0) / maxBills) * 100);
              return (
                <div key={`${month}-${i}`} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full flex gap-1 items-end" style={{ height: '200px' }}>
                    <div
                      className="flex-1 bg-emerald-500 rounded-t transition-all hover:bg-emerald-600"
                      style={{ height: `${visitsHeight}%` }}
                      title="Kunjungan"
                    />
                    <div
                      className="flex-1 bg-amber-500 rounded-t transition-all hover:bg-amber-600"
                      style={{ height: `${billsHeight}%` }}
                      title="Billing"
                    />
                  </div>
                  <span className="text-xs text-gray-600 font-medium">{month}</span>
                </div>
              );
            })}
          </div>
          <div className="flex justify-center gap-6 mt-6 pt-6 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-emerald-500 rounded"></div>
              <span className="text-sm text-gray-600">Kunjungan</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-amber-500 rounded"></div>
              <span className="text-sm text-gray-600">Billing</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-6">Ringkasan Cepat</h2>
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Kunjungan Hari Ini</p>
              <p className="text-lg font-bold text-gray-800">{new Intl.NumberFormat('id-ID').format(todayVisits)}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Resep Dikeluarkan</p>
              <p className="text-lg font-bold text-gray-800">{new Intl.NumberFormat('id-ID').format(todayPrescriptions)}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Tagihan Selesai</p>
              <p className="text-lg font-bold text-gray-800">{new Intl.NumberFormat('id-ID').format(todayCompletedBills)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-6">Kunjungan Terbaru</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Tanggal</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Pasien</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Poli</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Dokter</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Status</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600">Billing</th>
              </tr>
            </thead>
            <tbody>
              {recentVisits.map((v) => (
                <tr key={v.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 text-sm text-gray-600">{v.date}</td>
                  <td className="py-3 px-4 text-sm text-gray-800 font-medium">{v.patient}</td>
                  <td className="py-3 px-4 text-sm text-gray-600">{v.poli}</td>
                  <td className="py-3 px-4 text-sm text-gray-600">{v.doctor}</td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
                      v.status === 'Selesai'
                        ? 'bg-emerald-100 text-emerald-700'
                        : v.status === 'Pemeriksaan'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {v.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm text-right font-semibold text-amber-600">
                    {v.billing ? formatCurrency(v.billing) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
