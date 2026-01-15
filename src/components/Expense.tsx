import { Stethoscope, Search, Calendar } from 'lucide-react';
import { useMemo, useState } from 'react';

type Registration = {
  id: number;
  date: string;
  queue: number;
  patient: { name: string; nrm: string };
  poli: string;
  doctor: string;
  complaint: string;
  status: 'antrian' | 'batal' | 'selesai';
};

interface PemeriksaanRajalProps {
  registrations: Registration[];
  onOpenPatient?: (nrm: string) => void;
}

export default function PemeriksaanRajal({ registrations, onOpenPatient }: PemeriksaanRajalProps) {
  const pad = (n: number) => String(n).padStart(2, '0');
  const toISODate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = toISODate(new Date());
  const [poliFilter, setPoliFilter] = useState<string>('');

  const poliOptions = useMemo(() => {
    const all = Array.from(new Set(registrations.map((r) => r.poli)));
    return all;
  }, [registrations]);

  const rows = registrations
    .filter((r) => r.date === today)
    .filter((r) => (poliFilter ? r.poli === poliFilter : true));

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Pemeriksaan Rawat Jalan</h1>
          <p className="text-gray-600 mt-1">Kelola pemeriksaan pasien poli</p>
        </div>
        
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center">
            <Stethoscope className="w-7 h-7 text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-gray-600">Total Pemeriksaan ({today})</p>
            <p className="text-3xl font-bold text-blue-600">{rows.length}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-600" />
            <select
              value={poliFilter}
              onChange={(e) => setPoliFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              <option value="">Semua Poli</option>
              {poliOptions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input type="text" placeholder="Cari pemeriksaan (nama, poli, dokter)..." className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">No. Antrian</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Tanggal</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Pasien</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Poli</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Dokter</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Keluhan</th>
                <th className="text-right py-4 px-6 text-sm font-semibold text-gray-700">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-4 px-6 text-sm text-gray-800 font-medium">{r.queue}</td>
                  <td className="py-4 px-6 text-sm text-gray-600">{r.date}</td>
                  <td className="py-4 px-6 text-sm text-gray-800">
                    <button
                      className="font-semibold text-emerald-600 hover:underline"
                      onClick={() => onOpenPatient?.(r.patient.nrm)}
                    >
                      {r.patient.name}
                    </button>
                    <div className="text-xs text-gray-500">NRM: {r.patient.nrm}</div>
                  </td>
                  <td className="py-4 px-6 text-sm text-gray-600">{r.poli}</td>
                  <td className="py-4 px-6 text-sm text-gray-600">{r.doctor}</td>
                  <td className="py-4 px-6 text-sm text-gray-600">{r.complaint}</td>
                  <td className="py-4 px-6 text-right">
                    <button
                      onClick={() => onOpenPatient?.(r.patient.nrm)}
                      className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                    >
                      Periksa
                    </button>
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
