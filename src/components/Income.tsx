import { Plus, UserPlus, Search, Calendar, Edit2, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

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

interface PendaftaranProps {
  registrations: Registration[];
  onAdd: (data: { date: string; patient: { name: string; nrm: string }; poli: string; doctor: string; complaint: string }) => void;
  onUpdate: (id: number, changes: Partial<Registration>) => void;
  onDelete: (id: number) => void;
}

export default function Pendaftaran({ registrations, onAdd, onUpdate, onDelete }: PendaftaranProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const pad = (n: number) => String(n).padStart(2, '0');
  const toISODate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const [selectedDate, setSelectedDate] = useState<string>(toISODate(new Date()));
  const chipOffsets = [-2, -1, 0, 1, 2] as const;
  const chipDates = chipOffsets.map((i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return toISODate(d);
  });
  const [patientQuery, setPatientQuery] = useState('');
  const [patientOptions, setPatientOptions] = useState<{ name: string; nrm: string }[]>([
    { name: 'Andi', nrm: 'NRM-2024001' },
    { name: 'Siti', nrm: 'NRM-2024002' },
    { name: 'Ahmad Fauzi', nrm: 'NRM-2024003' },
    { name: 'Fatimah Zahra', nrm: 'NRM-2024004' },
    { name: 'Muhammad Rizki', nrm: 'NRM-2024005' },
    { name: 'Budi Santoso', nrm: 'NRM-2024010' },
    { name: 'Rina Kartika', nrm: 'NRM-2024011' },
    { name: 'Deni Pratama', nrm: 'NRM-2024012' },
  ]);
  useEffect(() => {
    let active = true;
    const fetchPatients = async () => {
      if (!supabase) return;
      const { data } = await supabase.from('patients').select('name,nrm').order('name', { ascending: true });
      if (!data || !active) return;
      setPatientOptions((data as { name: string; nrm: string }[]).map((p) => ({ name: p.name, nrm: p.nrm })));
    };
    fetchPatients();
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!supabase) return;
    const ch = supabase
      .channel('realtime-patient-options')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'patients' }, async () => {
        if (!supabase) return;
        const { data } = await supabase.from('patients').select('name,nrm').order('name', { ascending: true });
        if (!data) return;
        setPatientOptions((data as { name: string; nrm: string }[]).map((p) => ({ name: p.name, nrm: p.nrm })));
      })
      .subscribe();
    return () => {
      if (supabase) supabase.removeChannel(ch);
    };
  }, []);
  const filteredPatients =
    patientQuery.length >= 3
      ? patientOptions.filter((p) => p.name.toLowerCase().includes(patientQuery.toLowerCase()))
      : [];
  const [selectedPatient, setSelectedPatient] = useState<{ name: string; nrm: string } | null>(null);
  const statusLabel = { antrian: 'Antrian', batal: 'Batal', selesai: 'Selesai' } as const;
  const statusClass = {
    antrian: 'bg-blue-100 text-blue-700',
    batal: 'bg-red-100 text-red-700',
    selesai: 'bg-emerald-100 text-emerald-700',
  } as const;

  const [addDate, setAddDate] = useState<string>(toISODate(new Date()));
  const [addPoli, setAddPoli] = useState<string>('');
  const [addDoctor, setAddDoctor] = useState<string>('');
  const [addComplaint, setAddComplaint] = useState<string>('');
  const [doctorOptions, setDoctorOptions] = useState<{ id: string; name: string }[]>([]);
  const [editId, setEditId] = useState<number | null>(null);
  const [editDate, setEditDate] = useState<string>('');
  const [editPatientQuery, setEditPatientQuery] = useState<string>('');
  const [editSelectedPatient, setEditSelectedPatient] = useState<{ name: string; nrm: string } | null>(null);
  const [editPoli, setEditPoli] = useState<string>('');
  const [editDoctor, setEditDoctor] = useState<string>('');
  const [editComplaint, setEditComplaint] = useState<string>('');

  const filteredRegistrations = registrations.filter((r) => r.date === selectedDate);
  const totalRegistrations = filteredRegistrations.length;

  useEffect(() => {
    let active = true;
    const fetchDoctors = async () => {
      if (!supabase) return;
      const { data } = await supabase.from('doctors').select('id,name,active,deleted_at').order('name', { ascending: true });
      if (!data || !active) return;
      setDoctorOptions((data as { id: string; name: string; active?: boolean | null; deleted_at?: string | null }[])
        .filter((d) => (d.active ?? true) && !d.deleted_at)
        .map((d) => ({ id: d.id, name: d.name })));
    };
    fetchDoctors();
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!supabase) return;
    const ch = supabase
      .channel('realtime-doctor-options')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'doctors' }, async () => {
        if (!supabase) return;
        const { data } = await supabase.from('doctors').select('id,name,active,deleted_at').order('name', { ascending: true });
        if (!data) return;
        setDoctorOptions((data as { id: string; name: string; active?: boolean | null; deleted_at?: string | null }[])
          .filter((d) => (d.active ?? true) && !d.deleted_at)
          .map((d) => ({ id: d.id, name: d.name })));
      })
      .subscribe();
    return () => { if (supabase) supabase.removeChannel(ch); };
  }, []);

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Pendaftaran</h1>
          <p className="text-gray-600 mt-1">Kelola pendaftaran pasien poli</p>
        </div>
        <button
          onClick={() => {
            setAddDate(selectedDate);
            setSelectedPatient(null);
            setPatientQuery('');
            setAddPoli('');
            setAddDoctor('');
            setAddComplaint('');
            setShowAddModal(true);
          }}
          className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-lg hover:bg-emerald-700 transition-colors shadow-lg"
        >
          <Plus className="w-5 h-5" />
          <span className="font-medium">Tambah Pendaftaran</span>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-emerald-100 rounded-xl flex items-center justify-center">
            <UserPlus className="w-7 h-7 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm text-gray-600">Total Pendaftaran ({selectedDate})</p>
            <p className="text-3xl font-bold text-emerald-600">{totalRegistrations}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input type="text" placeholder="Cari pendaftaran (nama, poli, dokter)..." className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Calendar className="w-5 h-5 text-gray-600" />
            {chipDates.map((d) => (
              <button
                key={d}
                onClick={() => setSelectedDate(d)}
                className={`px-3 py-2 rounded-lg border transition-colors text-sm font-medium ${
                  selectedDate === d
                    ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {d}
              </button>
            ))}
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
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
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Status</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Keluhan</th>
                <th className="text-right py-4 px-6 text-sm font-semibold text-gray-700">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredRegistrations.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-4 px-6 text-sm text-gray-800 font-medium">{r.queue}</td>
                  <td className="py-4 px-6 text-sm text-gray-600">{r.date}</td>
                  <td className="py-4 px-6 text-sm text-gray-800 font-medium">{r.patient.name}</td>
                  <td className="py-4 px-6 text-sm text-gray-600">{r.poli}</td>
                  <td className="py-4 px-6 text-sm text-gray-600">{r.doctor}</td>
                  <td className="py-4 px-6 text-sm">
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${statusClass[r.status]}`}>
                      {statusLabel[r.status]}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-sm text-gray-600">{r.complaint}</td>
                  <td className="py-4 px-6 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setEditId(r.id);
                          setEditDate(r.date);
                          setEditPatientQuery(r.patient.name);
                          setEditSelectedPatient(r.patient);
                          setEditPoli(r.poli);
                          setEditDoctor(r.doctor);
                          setEditComplaint(r.complaint);
                          setShowEditModal(true);
                        }}
                        className="inline-flex items-center gap-1 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                      >
                        <Edit2 className="w-4 h-4" />
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('Hapus pendaftaran ini?')) onDelete(r.id);
                        }}
                        className="inline-flex items-center gap-1 px-3 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium"
                      >
                        <Trash2 className="w-4 h-4" />
                        Hapus
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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-800">Tambah Pendaftaran</h2>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tanggal
                </label>
                <input
                  type="date"
                  value={addDate}
                  onChange={(e) => setAddDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pasien
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={patientQuery}
                    onChange={(e) => setPatientQuery(e.target.value)}
                    placeholder="Ketik minimal 3 karakter (nama / NRM)"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                  {filteredPatients.length > 0 && (
                    <div className="absolute left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-auto z-10">
                      {filteredPatients.slice(0, 8).map((p) => (
                        <button
                          key={p.nrm}
                          type="button"
                          onClick={() => {
                            setPatientQuery(p.name);
                            setSelectedPatient(p);
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm text-gray-800"
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Poli
                </label>
                <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none">
                  <option value="">Pilih poli</option>
                  <option value="umum">Umum</option>
                  <option value="gigi">Gigi</option>
                  <option value="anak">Anak</option>
                  <option value="kebidanan">Kebidanan</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Dokter
                </label>
                <select
                  value={addDoctor}
                  onChange={(e) => setAddDoctor(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                >
                  <option value="">Pilih dokter</option>
                  {doctorOptions.map((d) => (
                    <option key={d.id} value={d.name}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Keluhan
                </label>
                <textarea
                  rows={3}
                  placeholder="Keluhan utama pasien..."
                  value={addComplaint}
                  onChange={(e) => setAddComplaint(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none"
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-gray-700"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  const patient = selectedPatient ?? { name: patientQuery || 'Pasien Baru', nrm: 'NRM-NEW' };
                  onAdd({ date: addDate, patient, poli: addPoli || 'Umum', doctor: addDoctor || '-', complaint: addComplaint || '-' });
                  setShowAddModal(false);
                }}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && editId !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-800">Edit Pendaftaran</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tanggal</label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Pasien</label>
                <div className="relative">
                  <input
                    type="text"
                    value={editPatientQuery}
                    onChange={(e) => setEditPatientQuery(e.target.value)}
                    placeholder="Ketik minimal 3 karakter (nama / NRM)"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                  {editPatientQuery.length >= 3 && (
                    <div className="absolute left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-auto z-10">
                      {patientOptions
                        .filter((p) => p.name.toLowerCase().includes(editPatientQuery.toLowerCase()))
                        .slice(0, 8)
                        .map((p) => (
                          <button
                            key={p.nrm}
                            type="button"
                            onClick={() => {
                              setEditPatientQuery(p.name);
                              setEditSelectedPatient(p);
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm text-gray-800"
                          >
                            {p.name}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Poli</label>
                <select
                  value={editPoli}
                  onChange={(e) => setEditPoli(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                >
                  <option value="Umum">Umum</option>
                  <option value="Gigi">Gigi</option>
                  <option value="Anak">Anak</option>
                  <option value="Kebidanan">Kebidanan</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Dokter</label>
                <select
                  value={editDoctor}
                  onChange={(e) => setEditDoctor(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                >
                  <option value="">Pilih dokter</option>
                  {doctorOptions.map((d) => (
                    <option key={d.id} value={d.name}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Keluhan</label>
                <textarea
                  rows={3}
                  value={editComplaint}
                  onChange={(e) => setEditComplaint(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none"
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-gray-700"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  if (editId === null) return;
                  const patient = editSelectedPatient ?? { name: editPatientQuery || 'Pasien', nrm: 'NRM-UNKNOWN' };
                  onUpdate(editId, { date: editDate, patient, poli: editPoli, doctor: editDoctor, complaint: editComplaint });
                  setShowEditModal(false);
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
