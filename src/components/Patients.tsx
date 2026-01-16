import { Plus, Search, Users, Phone, Mail, MapPin, CheckCircle2, XCircle, Clock, ArrowLeft, Calendar, Stethoscope, Pill, Edit2 } from 'lucide-react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';

interface Patient {
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
  records: {
    recordId?: string;
    createdAt?: string;
    date: string;
    poli: string;
    doctor: string;
    diagnosis: string;
    action: string;
    complaint?: string;
    medications: { name: string; dose?: string; qty?: number; unit?: string; price?: number }[];
    status: 'completed' | 'in_progress' | 'cancelled';
    cost: number;
    paidAmount: number;
  }[];
}

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

interface PatientsProps {
  initialNRM?: string;
  onClearInitialNRM?: () => void;
  registrations?: Registration[];
  patients?: Patient[];
  stockByName?: Record<string, number>;
  onConsumeMeds?: (meds: { name: string; qty?: number }[]) => void;
}

export default function Patients({ initialNRM, onClearInitialNRM, patients: externalPatients, stockByName, onConsumeMeds }: PatientsProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [viewStyle, setViewStyle] = useState<'card' | 'list'>('list');
  const [timelineView, setTimelineView] = useState<'cards' | 'table'>('cards');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showAddRecordModal, setShowAddRecordModal] = useState(false);
  const [showEditRecordModal, setShowEditRecordModal] = useState(false);
  const [showBillingModal, setShowBillingModal] = useState(false);
  const [showRecordDetailModal, setShowRecordDetailModal] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [billIndex, setBillIndex] = useState<number | null>(null);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);
  const [showEditPatientModal, setShowEditPatientModal] = useState(false);
  const [patientNameEdit, setPatientNameEdit] = useState<string>('');
  const [patientBirthDateEdit, setPatientBirthDateEdit] = useState<string>('');
  const [patientPhoneEdit, setPatientPhoneEdit] = useState<string>('');
  const [patientAddressEdit, setPatientAddressEdit] = useState<string>('');
  const [patientEmailEdit, setPatientEmailEdit] = useState<string>('');
  const [patientParentNameEdit, setPatientParentNameEdit] = useState<string>('');
  const [patientParentPhoneEdit, setPatientParentPhoneEdit] = useState<string>('');
  const [patientParentEmailEdit, setPatientParentEmailEdit] = useState<string>('');
  const [patientGenderEdit, setPatientGenderEdit] = useState<string>('');
  const [detailIndex, setDetailIndex] = useState<number | null>(null);
  const [editOverrides, setEditOverrides] = useState<Record<string, { [index: number]: Patient['records'][number] }>>({});
  const [extraRecords, setExtraRecords] = useState<Record<string, Patient['records'][number][]>>({});
  const [addedPatients, setAddedPatients] = useState<Patient[]>([]);
  const pad = (n: number) => String(n).padStart(2, '0');
  const toISODate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = toISODate(new Date());
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  };
  const formatAge = (birthStr: string) => {
    const b = new Date(birthStr);
    if (isNaN(b.getTime())) return '-';
    const now = new Date();
    let years = now.getFullYear() - b.getFullYear();
    let months = now.getMonth() - b.getMonth();
    if (now.getDate() < b.getDate()) months -= 1;
    if (months < 0) {
      years -= 1;
      months += 12;
    }
    if (years < 0) return '-';
    return `${years} tahun ${months} bulan`;
  };
  const [recDate, setRecDate] = useState<string>(today);
  const [recPoli, setRecPoli] = useState<string>('Umum');
  const [recDoctor, setRecDoctor] = useState<string>('');
  const [recDiagnosis, setRecDiagnosis] = useState<string>('');
  const [recAction, setRecAction] = useState<string>('');
  const [recComplaint, setRecComplaint] = useState<string>('');
  const [showDiagSuggest, setShowDiagSuggest] = useState<boolean>(false);
  const [showTindakanSuggest, setShowTindakanSuggest] = useState<boolean>(false);
  const [medQuery, setMedQuery] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchBirthDate, setSearchBirthDate] = useState<string>('');
  const [medOptions, setMedOptions] = useState<{ name: string; dose?: string; unit?: string }[]>([]);
  useEffect(() => {
    let active = true;
    (async () => {
      if (!supabase) return;
      const { data } = await supabase.from('drugs').select('name,dose,dose_unit,unit,active,price').order('name', { ascending: true });
      if (!data || !active) return;
      setMedOptions(
        (data as { name: string; dose?: string | null; dose_unit?: string | null; unit?: string | null; active?: boolean | null; price?: number | null }[])
          .filter((d) => (d.active ?? true))
          .map((d) => ({
            name: d.name,
            dose: d.dose && d.dose_unit ? `${d.dose} ${d.dose_unit}` : undefined,
            unit: d.unit || undefined,
          }))
      );
      const mapD: Record<string, number> = {};
      (data as { name: string; price?: number | null }[]).forEach((d) => {
        mapD[d.name.toLowerCase()] = Number(d.price ?? 0);
      });
      setDrugPriceByName(mapD);
      const mapN: Record<string, number> = {};
      (data as { name: string; price?: number | null }[]).forEach((d) => {
        mapN[(d.name || '').toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '')] = Number(d.price ?? 0);
      });
      setDrugPriceNormByName(mapN);
    })();
    return () => {
      active = false;
    };
  }, []);
  const [selectedMeds, setSelectedMeds] = useState<{ name: string; dose?: string; qty?: number; unit?: string }[]>([]);
  const [drugStockByName, setDrugStockByName] = useState<Record<string, number>>({});
  const medNamesKey = useMemo(() => selectedMeds.map((m) => m.name).sort().join('|'), [selectedMeds]);
  useEffect(() => {
    let active = true;
    (async () => {
      const names = Array.from(new Set(selectedMeds.map((m) => m.name)));
      if (names.length === 0) {
        if (active) setDrugStockByName({});
        return;
      }
      const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
      const fromPropNorm: Record<string, number> = {};
      if (stockByName) {
        for (const [k, v] of Object.entries(stockByName)) {
          fromPropNorm[norm(k)] = v;
        }
      }
      const out: Record<string, number> = {};
      const missing: string[] = [];
      names.forEach((n) => {
        const key = norm(n);
        const val = fromPropNorm[key];
        if (typeof val === 'number') {
          out[n] = val;
        } else {
          missing.push(n);
        }
      });
      if (missing.length > 0 && supabase) {
        const { data: drugs } = await supabase.from('drugs').select('id,name').in('name', missing);
        const ids = (drugs || []).map((d: { id: string }) => d.id);
        if (ids.length > 0) {
          const { data: batches } = await supabase
            .from('drug_batches')
            .select('drug_id,qty,deleted_at')
            .in('drug_id', ids)
            .is('deleted_at', null);
          const sumById = new Map<string, number>();
          (batches || []).forEach((b: { drug_id: string; qty?: number | null }) => {
            const prev = sumById.get(b.drug_id) || 0;
            sumById.set(b.drug_id, prev + Number(b.qty ?? 0));
          });
          (drugs || []).forEach((d: { id: string; name: string }) => {
            out[d.name] = sumById.get(d.id) ?? 0;
          });
        }
        const stillMissing = missing.filter((n) => typeof out[n] !== 'number' || out[n] === 0);
        if (stillMissing.length > 0) {
          for (const n of stillMissing) {
            const base = n
              .toLowerCase()
              .replace(/\d+(\.\d+)?\s*(mg|ml|tablet|capsule|tab|cap)/gi, '')
              .replace(/[^a-z0-9]+/gi, ' ')
              .trim();
            if (!base) continue;
            const { data: vrows } = await supabase
              .from('v_drug_stock')
              .select('name,total_qty')
              .ilike('name', `%${base}%`);
            const total = (vrows || []).reduce((s: number, r: { total_qty?: number | null }) => s + Number(r.total_qty ?? 0), 0);
            if (total > 0) out[n] = total;
          }
        }
      }
      if (active) setDrugStockByName(out);
    })();
    return () => {
      active = false;
    };
  }, [medNamesKey, stockByName]);
  const normalizeStock = useCallback((s: string) => s.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, ''), []);
  const stockNormMap = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(drugStockByName)) {
      out[normalizeStock(k)] = v;
    }
    return out;
  }, [drugStockByName, normalizeStock]);
  const getAvail = useCallback((name: string) => stockNormMap[normalizeStock(name)] ?? 0, [stockNormMap, normalizeStock]);
  const qtyExceedsStock = useMemo(
    () => selectedMeds.some((m) => (m.qty ?? 0) > getAvail(m.name)),
    [selectedMeds, getAvail]
  );
  const addMed = (opt: { name: string; dose?: string; unit?: string }) => {
    setSelectedMeds((prev) => {
      if (prev.some((m) => m.name === opt.name)) return prev;
      return [...prev, { name: opt.name, dose: opt.dose, unit: opt.unit, qty: undefined }];
    });
  };
  const updateMed = (index: number, changes: Partial<{ name: string; dose?: string; qty?: number; unit?: string }>) => {
    setSelectedMeds((prev) => prev.map((m, i) => (i === index ? { ...m, ...changes } : m)));
  };
  const removeMed = (index: number) => {
    setSelectedMeds((prev) => prev.filter((_, i) => i !== index));
  };
  // Form state for "Tambah Pasien Baru"
  const [addName, setAddName] = useState<string>('');
  const [addBirthDate, setAddBirthDate] = useState<string>('');
  const [addGender, setAddGender] = useState<string>('');
  const [addAddress, setAddAddress] = useState<string>('');
  const [addPhone, setAddPhone] = useState<string>('');
  const [addEmail, setAddEmail] = useState<string>('');
  const [addParentName, setAddParentName] = useState<string>('');
  const [addParentPhone, setAddParentPhone] = useState<string>('');
  const [addParentEmail, setAddParentEmail] = useState<string>('');
  const [poliOptions, setPoliOptions] = useState<{ id: string; name: string }[]>([]);
  const [doctorOptions, setDoctorOptions] = useState<{ id: string; name: string; poli_id?: string | null }[]>([]);
  const [diagOptions, setDiagOptions] = useState<{ code?: string | null; name: string }[]>([]);
  const [tindakanOptions, setTindakanOptions] = useState<{ code?: string | null; name: string }[]>([]);
  const [procPriceByName, setProcPriceByName] = useState<Record<string, number>>({});
  const [drugPriceByName, setDrugPriceByName] = useState<Record<string, number>>({});
  const [drugPriceNormByName, setDrugPriceNormByName] = useState<Record<string, number>>({});
  const [actionPriceEdit, setActionPriceEdit] = useState<number>(0);
  const [actionPriceStr, setActionPriceStr] = useState<string>('0');
  const [medPriceEdits, setMedPriceEdits] = useState<number[]>([]);
  const [medPriceStrEdits, setMedPriceStrEdits] = useState<string[]>([]);
  const [payNow, setPayNow] = useState<number>(0);
  const [payNowStr, setPayNowStr] = useState<string>('0');

  const formatCurrency = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;
  const formatNumber = (n: number) => new Intl.NumberFormat('id-ID').format(n);
  const parseNumber = (s: string) => Number((s || '').replace(/[^\d]/g, '') || '0');
  const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
  const resolveMedPrice = useCallback((name: string) => {
    const key = name.toLowerCase();
    let p = drugPriceByName[key];
    if (!p || p <= 0) {
      const nk = normalize(name);
      p = drugPriceNormByName[nk];
      if (!p || p <= 0) {
        for (const [k, v] of Object.entries(drugPriceNormByName)) {
          if (v > 0 && (nk.includes(k) || k.includes(nk))) {
            p = v;
            break;
          }
        }
      }
    }
    return Number(p ?? 0);
  }, [drugPriceByName, drugPriceNormByName]);
  const combinedRecords = useMemo(() => {
    const base = selectedPatient?.records || [];
    const extras = selectedPatient ? (extraRecords[selectedPatient.nrm] || []) : [];
    const merged = [...base, ...extras];
    const overrides = selectedPatient ? (editOverrides[selectedPatient.nrm] || {}) : {};
    return merged.map((rec, idx) => (overrides[idx] ? { ...rec, ...overrides[idx] } : rec));
  }, [selectedPatient, extraRecords, editOverrides]);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!supabase) return;
      const [{ data: polies }, { data: doctors }, { data: diagnoses }, { data: procedures }] = await Promise.all([
        supabase.from('polies').select('id,name').is('deleted_at', null).order('name', { ascending: true }),
        supabase.from('doctors').select('id,name,poli_id,active').is('deleted_at', null).order('name', { ascending: true }),
        supabase.from('diagnoses').select('code,name').is('deleted_at', null).order('name', { ascending: true }),
        supabase.from('procedures').select('code,name,category,active,default_cost').is('deleted_at', null).order('name', { ascending: true }),
      ]);
      if (!active) return;
      setPoliOptions((polies || []).map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })));
      setDoctorOptions((doctors || []).filter((d: { active?: boolean | null }) => d.active ?? true).map((d: { id: string; name: string; poli_id?: string | null }) => ({ id: d.id, name: d.name, poli_id: d.poli_id ?? null })));
      setDiagOptions((diagnoses || []).map((d: { code?: string | null; name: string }) => ({ code: d.code ?? null, name: d.name })));
      setTindakanOptions((procedures || []).filter((p: { category?: string | null; active?: boolean | null }) => (p.category ?? 'tindakan') === 'tindakan' && (p.active ?? true)).map((p: { code?: string | null; name: string }) => ({ code: p.code ?? null, name: p.name })));
      const mapP: Record<string, number> = {};
      (procedures || [])
        .filter((p: { category?: string | null }) => (p.category ?? 'tindakan') === 'tindakan')
        .forEach((p: { name: string; default_cost?: number | null }) => {
          mapP[p.name.toLowerCase()] = Number(p.default_cost ?? 0);
        });
      setProcPriceByName(mapP);
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (poliOptions.length > 0 && !poliOptions.some((p) => p.name === recPoli)) {
      setRecPoli(poliOptions[0].name);
    }
  }, [poliOptions, recPoli]);
  useEffect(() => {
    const selectedPoliId = poliOptions.find((p) => p.name === recPoli)?.id;
    let docList = selectedPoliId ? doctorOptions.filter((d) => d.poli_id === selectedPoliId) : doctorOptions;
    if (docList.length === 0) {
      docList = doctorOptions;
    }
    if (docList.length > 0 && !docList.some((d) => d.name === recDoctor)) {
      setRecDoctor(docList[0].name);
    }
  }, [doctorOptions, recPoli, poliOptions, recDoctor]);
  const openEditRecord = (idx: number) => {
    if (!selectedPatient) return;
    const rec = combinedRecords[idx];
    setEditIndex(idx);
    setRecDate(rec.date);
    setRecPoli(rec.poli);
    setRecDoctor(rec.doctor);
    setRecDiagnosis(rec.diagnosis);
    setRecAction(rec.action);
    setRecComplaint(rec.complaint || '');
    setSelectedMeds(rec.medications.map((m) => ({ name: m.name, dose: m.dose, qty: m.qty, unit: m.unit })));
    setShowEditRecordModal(true);
  };

  useEffect(() => {
    if (!showBillingModal || billIndex === null) return;
    const rec = combinedRecords[billIndex];
    const unitPrices = rec.medications.map((m) => {
      const base = (m.price ?? 0) > 0 ? Number(m.price) : resolveMedPrice(m.name);
      return Number(base ?? 0);
    });
    const medsTotal = rec.medications.reduce((sum, m, i) => sum + (unitPrices[i] ?? 0) * (m.qty ?? 0), 0);
    const tindakanPrice = (rec.cost && rec.cost > 0) ? Math.max(0, Number(rec.cost) - medsTotal) : (procPriceByName[rec.action.toLowerCase()] ?? 0);
    setActionPriceEdit(tindakanPrice);
    setMedPriceEdits(unitPrices);
    setMedPriceStrEdits(unitPrices.map((p) => formatNumber(p)));
    const total = tindakanPrice + rec.medications.reduce((sum, m, i) => sum + (unitPrices[i] ?? 0) * (m.qty ?? 0), 0);
    const paid = rec.paidAmount ?? 0;
    setPayNow(Math.max(0, total - paid));
  }, [showBillingModal, billIndex, drugPriceByName, procPriceByName, combinedRecords, resolveMedPrice]);

  useEffect(() => {
    if (!showBillingModal || billIndex === null) return;
    const rec = combinedRecords[billIndex];
    const medsTotal = rec.medications.reduce((sum, m, i) => sum + (medPriceEdits[i] ?? 0) * (m.qty ?? 0), 0);
    const total = actionPriceEdit + medsTotal;
    const paid = rec.paidAmount ?? 0;
    const next = Math.max(0, total - paid);
    setPayNow(next);
    setPayNowStr(formatNumber(next));
  }, [showBillingModal, billIndex, combinedRecords, actionPriceEdit, medPriceEdits]);
  const patients: Patient[] = useMemo(() => {
    const base = externalPatients ?? [];
    const combined = [...base, ...addedPatients];
    const byNRM = new Map<string, Patient>();
    combined.forEach((p) => {
      if (!byNRM.has(p.nrm)) byNRM.set(p.nrm, p);
    });
    return Array.from(byNRM.values());
  }, [externalPatients, addedPatients]);
  const displayPatients = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return patients.filter((p) => {
      const birthMatch =
        !searchBirthDate || p.birthDate === searchBirthDate;
      const textMatch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.nrm.toLowerCase().includes(q) ||
        p.address.toLowerCase().includes(q) ||
        p.birthDate.toLowerCase().includes(q) ||
        formatDate(p.birthDate).toLowerCase().includes(q);
      return birthMatch && textMatch;
    });
  }, [patients, searchQuery, searchBirthDate]);

  useEffect(() => {
    if (initialNRM) {
      const found = patients.find((p) => p.nrm === initialNRM);
      if (found) {
        setSelectedPatient(found);
        setView('detail');
        onClearInitialNRM?.();
      }
    }
  }, [initialNRM, onClearInitialNRM, patients]);
  useEffect(() => {
    if (!selectedPatient) return;
    const found = patients.find((p) => p.nrm === selectedPatient.nrm);
    if (found) setSelectedPatient(found);
  }, [patients]);

  const handleViewDetail = (patient: Patient) => {
    setSelectedPatient(patient);
    setView('detail');
    window.location.hash = `/patients/${patient.nrm}`;
  };

  const getRecordStatusBadge = (status: 'completed' | 'in_progress' | 'cancelled') => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
            <CheckCircle2 className="w-3 h-3" />
            Selesai
          </span>
        );
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
            <Clock className="w-3 h-3" />
            Proses
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
            <XCircle className="w-3 h-3" />
            Batal
          </span>
        );
    }
  };

  return (
    <div className="p-8">
      {view === 'list' && (
        <>
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Data Pasien</h1>
              <p className="text-gray-600 mt-1">Kelola data pasien dan rekam medis</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-gray-100 rounded-lg p-1">
                <div className="flex">
                  <button
                    onClick={() => setViewStyle('card')}
                    className={`px-4 py-2 text-sm rounded-md ${viewStyle === 'card' ? 'bg-white shadow-sm font-semibold' : 'text-gray-600'}`}
                  >
                    Card
                  </button>
                  <button
                    onClick={() => setViewStyle('list')}
                    className={`px-4 py-2 text-sm rounded-md ${viewStyle === 'list' ? 'bg-white shadow-sm font-semibold' : 'text-gray-600'}`}
                  >
                    List
                  </button>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-lg hover:bg-emerald-700 transition-colors shadow-lg"
              >
                <Plus className="w-5 h-5" />
                <span className="font-medium">Tambah Pasien</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Cari pasien (nama, NRM, tanggal lahir)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                />
              </div>
              <input
                type="date"
                value={searchBirthDate}
                onChange={(e) => setSearchBirthDate(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              />
            </div>
          </div>

          {viewStyle === 'card' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayPatients.map((patient) => {
                const completedCount = patient.records.filter(r => r.status === 'completed').length;
                const totalRecords = patient.records.length;
                return (
                  <div key={patient.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-start gap-4">
                      <div className="w-14 h-14 bg-blue-50 rounded-xl flex items-center justify-center">
                        <Users className="w-7 h-7 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex flex-wrap gap-2 items-center justify-between">
                          <button
                            onClick={() => handleViewDetail(patient)}
                            className="text-lg font-bold text-blue-600 hover:underline"
                          >
                            {patient.name}
                          </button>
                          <div className="flex flex-wrap gap-2">
                            <span className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-xs">
                              <span className="font-semibold">NRM</span> {patient.nrm}
                            </span>
                            <span className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                              <Clock className="w-4 h-4" /> {formatAge(patient.birthDate)}
                            </span>
                          </div>
                        </div>
                        <div className="mt-2 space-y-2">
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Calendar className="w-4 h-4" />
                            <span>{formatDate(patient.birthDate)}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Clock className="w-4 h-4" />
                            <span>{formatAge(patient.birthDate)}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <MapPin className="w-4 h-4" />
                            <span className="line-clamp-1">{patient.address}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                      <div className="w-3/5">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-medium text-gray-700">Kunjungan Tahun Ini</span>
                          <span className="text-xs font-bold text-emerald-600">{completedCount}/{totalRecords}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-emerald-500 h-2 rounded-full transition-all"
                            style={{ width: `${(completedCount / totalRecords) * 100}%` }}
                          />
                        </div>
                      </div>
                      <div>
                        <button
                          onClick={() => handleViewDetail(patient)}
                          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium"
                        >
                          Lihat Detail
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">NRM</th>
                      <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Nama</th>
                      <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Tanggal Lahir</th>
                      <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Alamat</th>
                      <th className="text-center py-4 px-6 text-sm font-semibold text-gray-700">Kunjungan</th>
                      <th className="text-right py-4 px-6 text-sm font-semibold text-gray-700">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                          {displayPatients.map((p) => {
                            const completed = p.records.filter(r => r.status === 'completed').length;
                            return (
                              <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                                <td className="py-4 px-6 text-sm text-gray-800 font-medium">{p.nrm}</td>
                                <td className="py-4 px-6 text-sm">
                            <button
                              onClick={() => handleViewDetail(p)}
                              className="text-blue-600 hover:underline font-medium"
                            >
                              {p.name}
                            </button>
                          </td>
                          <td className="py-4 px-6 text-sm text-gray-600">
                            <div className="flex flex-col">
                              <span className="text-gray-800">{formatDate(p.birthDate)}</span>
                              <span className="text-xs text-gray-500">{formatAge(p.birthDate)}</span>
                            </div>
                          </td>
                          <td className="py-4 px-6 text-sm text-gray-600 line-clamp-1">{p.address}</td>
                          <td className="py-4 px-6 text-center text-sm font-semibold text-emerald-600">{completed}/{p.records.length}</td>
                          <td className="py-4 px-6 text-right">
                            <button
                              onClick={() => handleViewDetail(p)}
                              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm"
                            >
                              Detail
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {view === 'detail' && selectedPatient && (
        <div className="">
          <div className="mb-6 flex items-center justify-between">
            <button
              onClick={() => { setView('list'); setSelectedPatient(null); window.location.hash = '/patients'; }}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="font-medium">Kembali</span>
            </button>
          </div>

          <div className="bg-blue-50 rounded-xl shadow-sm border border-blue-100 p-6 mb-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-emerald-100 rounded-xl flex items-center justify-center">
                <Users className="w-8 h-8 text-emerald-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-800">{selectedPatient.name}</h2>
                <div className="mt-1 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm">
                    <span className="font-semibold">NRM</span> {selectedPatient.nrm}
                  </span>
                  <span className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                    <Calendar className="w-4 h-4" /> {formatDate(selectedPatient.birthDate)}
                  </span>
                  <span className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm">
                    <Clock className="w-4 h-4" /> {formatAge(selectedPatient.birthDate)}
                  </span>
                  <span className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm">
                    <MapPin className="w-4 h-4" /> {selectedPatient.address}
                  </span>
                </div>
              </div>
              <div className="ml-auto">
                <button
                  onClick={() => {
                    if (!selectedPatient) return;
                    setPatientNameEdit(selectedPatient.name);
                    setPatientBirthDateEdit(selectedPatient.birthDate || '');
                    setPatientPhoneEdit(selectedPatient.phone || '');
                    setPatientAddressEdit(selectedPatient.address || '');
                    setPatientEmailEdit(selectedPatient.email || '');
                    setPatientParentNameEdit(selectedPatient.parentName || '');
                    setPatientParentPhoneEdit(selectedPatient.parentPhone || '');
                    setPatientParentEmailEdit(selectedPatient.parentEmail || '');
                    setPatientGenderEdit('');
                    setShowEditPatientModal(true);
                  }}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-colors text-sm font-medium"
                >
                  <Edit2 className="w-4 h-4" />
                  Ubah
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-blue-50 rounded-xl p-6 border border-blue-100">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Informasi Pasien</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Calendar className="w-4 h-4" />
                  <span>Tgl Lahir: <span className="font-medium text-gray-800">{formatDate(selectedPatient.birthDate)}</span></span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Phone className="w-4 h-4" />
                  <span>Telepon: <span className="font-medium text-gray-800">{selectedPatient.phone}</span></span>
                </div>
                <div className="flex items-start gap-2 text-sm text-gray-600">
                  <MapPin className="w-4 h-4 mt-0.5" />
                  <span>Alamat: <span className="font-medium text-gray-800">{selectedPatient.address}</span></span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Stethoscope className="w-4 h-4" />
                  <span>Poli: <span className="font-medium text-gray-800">{selectedPatient.poli}</span></span>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 rounded-xl p-6 border border-blue-100">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Kontak Darurat</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Users className="w-4 h-4" />
                  <span>Nama Orang Tua/Wali: <span className="font-medium text-gray-800">{selectedPatient.parentName}</span></span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Phone className="w-4 h-4" />
                  <span>No. Telepon: <span className="font-medium text-gray-800">{selectedPatient.parentPhone}</span></span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Mail className="w-4 h-4" />
                  <span>Email: <span className="font-medium text-gray-800">{selectedPatient.parentEmail}</span></span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 rounded-xl shadow-sm border border-blue-100 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-800">Timeline Rekam Medis</h3>
              <div className="flex items-center gap-4">
                <div className="text-sm text-gray-600">
                  Total: <span className="font-semibold text-gray-800">{selectedPatient.records.length}</span>
                </div>
                <div className="text-sm text-emerald-600">
                  Selesai: <span className="font-semibold">{selectedPatient.records.filter(r => r.status === 'completed').length}</span>
                </div>
                <div className="bg-gray-100 rounded-lg p-1">
                  <div className="flex">
                    <button
                      onClick={() => setTimelineView('cards')}
                      className={`px-3 py-1 text-xs rounded-md ${timelineView === 'cards' ? 'bg-white shadow-sm font-semibold' : 'text-gray-600'}`}
                    >
                      Cards
                    </button>
                    <button
                      onClick={() => setTimelineView('table')}
                      className={`px-3 py-1 text-xs rounded-md ${timelineView === 'table' ? 'bg-white shadow-sm font-semibold' : 'text-gray-600'}`}
                    >
                      Table
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setRecDate(today);
                    setRecPoli(selectedPatient.poli);
                    setRecDoctor('');
                    setRecDiagnosis('');
                    setRecAction('');
                    setRecComplaint('');
                    setMedQuery('');
                    setSelectedMeds([]);
                    setShowAddRecordModal(true);
                  }}
                  className="px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium shadow-sm"
                >
                  Input Rekam Medis
                </button>
              </div>
            </div>
            {timelineView === 'cards' ? (
              <div className="space-y-4">
                {combinedRecords
                  .slice()
                  .sort((a, b) => (b.createdAt || b.date).localeCompare(a.createdAt || a.date))
                  .map((rec, idx) => (
                  <div
                    key={idx}
                    className={`border border-gray-200 rounded-xl overflow-hidden ${idx % 2 === 1 ? 'bg-blue-900/10' : 'bg-white'}`}
                  >
                    <div className={`${idx % 2 === 1 ? 'bg-blue-900/20 text-gray-100' : 'bg-gray-50'} px-4 py-3 flex flex-wrap items-center justify-between gap-3`}>
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="w-4 h-4" />
                        <span className="font-semibold">{rec.date}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Stethoscope className="w-4 h-4" />
                        <span className="font-medium">{rec.poli} • {rec.doctor}</span>
                      </div>
                      <div>
                        {getRecordStatusBadge(rec.status)}
                      </div>
                    </div>
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <div className="text-xs text-gray-500">Diagnosa</div>
                            <div className="text-sm font-medium text-gray-800">{rec.diagnosis}</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500">Tindakan</div>
                            <div className="text-sm font-medium text-gray-800">{rec.action}</div>
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Keluhan</div>
                          <div className="text-sm font-medium text-gray-800">{rec.complaint || '-'}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Biaya</div>
                          <div className="text-sm font-semibold text-gray-900">{formatCurrency(rec.cost)}</div>
                          <div className="text-xs font-medium text-emerald-600">{`Paid: ${formatCurrency(rec.paidAmount)}`}</div>
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Pill className="w-4 h-4 text-amber-600" />
                          <span className="text-sm font-semibold text-gray-800">Obat</span>
                        </div>
                        <div className="space-y-2">
                          {(() => {
                            const meds = rec.medications.filter((m) => (m.qty ?? 0) > 0);
                            return meds.length === 0 ? (
                              <span className="text-sm text-gray-600">Tidak ada obat</span>
                            ) : (
                              meds.map((m, i) => (
                                <div key={i} className="flex items-center gap-2 px-3 py-2 bg-amber-50 rounded-lg text-xs text-amber-700">
                                  <span className="font-medium">{m.name}</span>
                                  {m.dose && <span>• {m.dose}</span>}
                                  <span>• {m.qty}{m.unit && ` ${m.unit}`}</span>
                                </div>
                              ))
                            );
                          })()}
                        </div>
                      </div>
                      <div className="md:col-span-2 flex flex-wrap items-center justify-end gap-2 mt-2">
                        <button
                          onClick={() => { setDetailIndex(combinedRecords.indexOf(rec)); setShowRecordDetailModal(true); }}
                          className="inline-flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-xs sm:text-sm font-medium"
                        >
                          <Search className="w-4 h-4" />
                          Lihat
                        </button>
                        {rec.status !== 'completed' && (
                          <>
                            <button
                              onClick={() => openEditRecord(combinedRecords.indexOf(rec))}
                              className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-colors text-xs sm:text-sm font-medium"
                            >
                              <Edit2 className="w-4 h-4" />
                              Edit
                            </button>
                            {rec.status === 'in_progress' && (
                              <button
                                onClick={() => { setDeleteIndex(combinedRecords.indexOf(rec)); setShowDeleteConfirmModal(true); }}
                                className="inline-flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-300 text-red-700 rounded-lg hover:bg-red-100 transition-colors text-xs sm:text-sm font-medium"
                              >
                                <XCircle className="w-4 h-4" />
                                Hapus
                              </button>
                            )}
                            <button
                              onClick={() => {
                                const origIdx = combinedRecords.indexOf(rec);
                                setBillIndex(origIdx);
                            const rec0 = rec;
                            const prices = rec0.medications.map((m) => {
                              const base = (m.price ?? 0) > 0 ? Number(m.price) : resolveMedPrice(m.name);
                              return Number(base ?? 0);
                            });
                            setMedPriceEdits(prices);
                            setMedPriceStrEdits(prices.map((p) => formatNumber(p)));
                            const medsTotal = rec0.medications.reduce((sum, m, i) => sum + (prices[i] ?? 0) * (m.qty ?? 0), 0);
                            const tindakanPrice = (rec0.cost && rec0.cost > 0) ? Math.max(0, Number(rec0.cost) - medsTotal) : (procPriceByName[rec0.action.toLowerCase()] ?? 0);
                            setActionPriceEdit(tindakanPrice);
                            setActionPriceStr(formatNumber(tindakanPrice));
                            const total = tindakanPrice + medsTotal;
                            const paid = rec0.paidAmount ?? 0;
                            setPayNow(Math.max(0, total - paid));
                            setPayNowStr(formatNumber(Math.max(0, total - paid)));
                            setShowBillingModal(true);
                          }}
                          className="inline-flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-100 transition-colors text-xs sm:text-sm font-medium"
                        >
                          Bayar
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="px-4 py-2 text-xs text-gray-500 bg-gray-50 border-t border-gray-200">
                      ID Rekam: {selectedPatient.nrm}-{combinedRecords.indexOf(rec) + 1}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Tanggal</th>
                        <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Poli / Dokter</th>
                        <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Diagnosa</th>
                        <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Tindakan</th>
                        <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Obat</th>
                        <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Biaya</th>
                        <th className="text-center py-4 px-6 text-sm font-semibold text-gray-700">Status</th>
                        <th className="text-right py-4 px-6 text-sm font-semibold text-gray-700">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {combinedRecords
                        .slice()
                        .sort((a, b) => (b.createdAt || b.date).localeCompare(a.createdAt || a.date))
                        .map((rec, idx) => (
                        <tr
                          key={idx}
                          className={`transition-colors align-top ${
                            idx % 2 === 0 ? 'bg-gray-100 hover:bg-gray-200' : 'bg-gray-200 hover:bg-gray-300'
                          }`}
                        >
                          <td className="py-4 px-6 text-sm text-gray-800">{rec.date}</td>
                          <td className="py-4 px-6 text-sm text-gray-600">
                            <div className="flex items-start gap-2">
                              <Stethoscope className="w-4 h-4" />
                              <div className="flex flex-col md:flex-row md:items-center md:gap-2">
                                <span className="font-medium text-gray-800">{rec.poli}</span>
                                <span className="hidden md:inline text-gray-500">•</span>
                                <span className="text-gray-500">{rec.doctor}</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-6 text-sm text-gray-800">{rec.diagnosis}</td>
                          <td className="py-4 px-6 text-sm text-gray-800">{rec.action}</td>
                          <td className="py-4 px-6">
                            <div className="flex flex-wrap gap-2">
                              {(() => {
                                const meds = rec.medications.filter((m) => (m.qty ?? 0) > 0);
                                return meds.length === 0 ? (
                                  <span className="text-sm text-gray-600">Tidak ada obat</span>
                                ) : (
                                  meds.map((m, i) => (
                                    <span key={i} className="inline-flex items-center gap-2 px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-xs">
                                      {m.name}{m.dose ? ` ${m.dose}` : ''}{` • ${m.qty}${m.unit ? ` ${m.unit}` : ''}`}{m.price ? ` • ${formatCurrency(m.price)}` : ''}
                                    </span>
                                  ))
                                );
                              })()}
                            </div>
                          </td>
                          <td className="py-4 px-6 text-left">
                            <div className="space-y-1">
                              <div className="text-sm font-semibold text-gray-900">{formatCurrency(rec.cost)}</div>
                              <div className="text-xs font-medium text-emerald-600">{`Paid: ${formatCurrency(rec.paidAmount)}`}</div>
                            </div>
                          </td>
                          <td className="py-4 px-6 text-center">
                            {getRecordStatusBadge(rec.status)}
                          </td>
                            <td className="py-4 px-6 text-right">
                              <button
                                onClick={() => { setDetailIndex(combinedRecords.indexOf(rec)); setShowRecordDetailModal(true); }}
                                className="inline-flex items-center gap-2 mr-2 px-3 py-2 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
                              >
                                <Search className="w-4 h-4" />
                                Lihat
                              </button>
                              {rec.status !== 'completed' && (
                                <>
                                  <button
                                    onClick={() => openEditRecord(combinedRecords.indexOf(rec))}
                                    className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-colors text-sm font-medium"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                    Edit
                                  </button>
                                  {rec.status === 'in_progress' && (
                                    <button
                                      onClick={() => { setDeleteIndex(combinedRecords.indexOf(rec)); setShowDeleteConfirmModal(true); }}
                                      className="inline-flex items-center gap-2 ml-2 px-3 py-2 bg-red-50 border border-red-300 text-red-700 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
                                    >
                                      <XCircle className="w-4 h-4" />
                                      Hapus
                                    </button>
                                  )}
                                  <button
                                    onClick={() => {
                                      const origIdx = combinedRecords.indexOf(rec);
                                      setBillIndex(origIdx);
                                      const rec0 = rec;
                                      const tindakanPrice = procPriceByName[rec0.action.toLowerCase()] ?? 0;
                                      setActionPriceEdit(tindakanPrice);
                                      const prices = rec0.medications.map((m) => {
                                        const base = (m.price ?? 0) > 0 ? Number(m.price) : resolveMedPrice(m.name);
                                        return Number(base ?? 0);
                                      });
                                      setMedPriceEdits(prices);
                                      setMedPriceStrEdits(prices.map((p) => formatNumber(p)));
                                      const total = tindakanPrice + rec0.medications.reduce((sum, m, i) => sum + (prices[i] ?? 0) * (m.qty ?? 0), 0);
                                      const paid = rec0.paidAmount ?? 0;
                                      setPayNow(Math.max(0, total - paid));
                                      setPayNowStr(formatNumber(Math.max(0, total - paid)));
                                      setActionPriceStr(formatNumber(tindakanPrice));
                                      setShowBillingModal(true);
                                    }}
                                    className="inline-flex items-center gap-2 ml-2 px-3 py-2 bg-amber-50 border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-100 transition-colors text-sm font-medium"
                                  >
                                    Bayar
                                  </button>
                                </>
                              )}
                            </td>
                          </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showEditRecordModal && selectedPatient && editIndex !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto mx-4">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-800">Edit Rekam Medis</h2>
              <span className="text-sm text-gray-500">ID: {selectedPatient.nrm}-{editIndex + 1}</span>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Tanggal</label>
                    <input
                      type="date"
                      value={recDate}
                      onChange={(e) => setRecDate(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Poli</label>
                      <select
                        value={recPoli}
                        onChange={(e) => setRecPoli(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      >
                        {poliOptions.length === 0 ? (
                          <option>Memuat...</option>
                        ) : (
                          poliOptions.map((p) => (
                            <option key={p.id} value={p.name}>
                              {p.name}
                            </option>
                          ))
                        )}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Dokter</label>
                      <select
                        value={recDoctor}
                        onChange={(e) => setRecDoctor(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      >
                        {(() => {
                          const selectedPoliId = poliOptions.find((p) => p.name === recPoli)?.id;
                          let docList = selectedPoliId ? doctorOptions.filter((d) => d.poli_id === selectedPoliId) : doctorOptions;
                          if (docList.length === 0) docList = doctorOptions;
                          if (docList.length === 0) return <option>Tidak ada dokter</option>;
                          return docList.map((d) => (
                            <option key={d.id} value={d.name}>
                              {d.name}
                            </option>
                          ));
                        })()}
                      </select>
                    </div>
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Keluhan</label>
                    <textarea
                      rows={4}
                      placeholder="Keluhan utama..."
                      value={recComplaint}
                      onChange={(e) => setRecComplaint(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none"
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Diagnosa</label>
                    <div className="relative">
                      <textarea
                        rows={4}
                        placeholder="Diagnosa"
                        value={recDiagnosis}
                        onChange={(e) => setRecDiagnosis(e.target.value)}
                        onFocus={() => setShowDiagSuggest(true)}
                        onClick={() => setShowDiagSuggest(true)}
                        onBlur={() => {
                          setTimeout(() => setShowDiagSuggest(false), 120);
                        }}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none"
                      />
                      {showDiagSuggest && (
                        <div className="absolute left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-auto z-10">
                          {(recDiagnosis.trim().length >= 2
                            ? diagOptions.filter(
                                (d) =>
                                  d.name.toLowerCase().includes(recDiagnosis.trim().toLowerCase()) ||
                                  (d.code ?? '').toLowerCase().includes(recDiagnosis.trim().toLowerCase())
                              )
                            : diagOptions.slice(0, 10)
                          )
                            .slice(0, 10)
                            .map((d) => (
                              <button
                                key={`${d.code ?? ''}-${d.name}`}
                                type="button"
                                onClick={() => {
                                  setRecDiagnosis(d.name);
                                  setShowDiagSuggest(false);
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm text-gray-800"
                              >
                                {(d.code ? `${d.code} • ` : '') + d.name}
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Tindakan</label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Tindakan"
                        value={recAction}
                        onChange={(e) => setRecAction(e.target.value)}
                        onFocus={() => setShowTindakanSuggest(true)}
                        onClick={() => setShowTindakanSuggest(true)}
                        onBlur={() => {
                          setTimeout(() => setShowTindakanSuggest(false), 120);
                        }}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      />
                      {showTindakanSuggest && (
                        <div className="absolute left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-auto z-10">
                          {(recAction.trim().length >= 2
                            ? tindakanOptions.filter(
                                (t) =>
                                  t.name.toLowerCase().includes(recAction.trim().toLowerCase()) ||
                                  (t.code ?? '').toLowerCase().includes(recAction.trim().toLowerCase())
                              )
                            : tindakanOptions.slice(0, 10)
                          )
                            .slice(0, 10)
                            .map((t) => (
                              <button
                                key={`${t.code ?? ''}-${t.name}`}
                                type="button"
                                onClick={() => {
                                  setRecAction(t.name);
                                  setShowTindakanSuggest(false);
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm text-gray-800"
                              >
                                {(t.code ? `${t.code} • ` : '') + t.name}
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Obat</label>
                  <input
                    type="text"
                    value={medQuery}
                    onChange={(e) => setMedQuery(e.target.value)}
                    placeholder="Cari obat, lalu pilih untuk menambahkan (bisa multiple)"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                  {medQuery.length >= 2 && (
                    <div className="absolute left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-auto z-10">
                      {medOptions
                        .filter((m) => m.name.toLowerCase().includes(medQuery.toLowerCase()))
                        .filter((m) => !selectedMeds.some((s) => s.name === m.name))
                        .slice(0, 10)
                        .map((m) => (
                          <button
                            key={m.name}
                            type="button"
                            onClick={() => {
                              addMed(m);
                              setMedQuery('');
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm text-gray-800"
                          >
                            {m.name}{m.dose ? ` ${m.dose}` : ''}{m.unit ? ` • ${m.unit}` : ''}
                          </button>
                        ))}
                    </div>
                  )}
                  <div className="mt-3 max-h-[60vh] overflow-y-auto pr-1">
                    {selectedMeds.length === 0 ? (
                      <div className="text-sm text-gray-600">Belum ada obat dipilih</div>
                    ) : (
                      <div className="space-y-3">
                        {selectedMeds.map((m, idx) => (
                          <div key={m.name} className="p-3 border border-gray-200 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-2 px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-xs">
                                  {m.name}{m.dose ? ` ${m.dose}` : ''}{m.unit ? ` • ${m.unit}` : ''}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeMed(idx)}
                                className="text-red-600 text-xs px-2 py-1 border border-red-300 rounded hover:bg-red-50"
                              >
                                Hapus
                              </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div className="md:col-span-3">
                                <label className="block text-xs font-medium text-gray-700 mb-1">Jumlah</label>
                                <input
                                  type="number"
                                  min={0}
                                  value={m.qty === undefined ? '' : String(m.qty)}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    if (v === '') {
                                      updateMed(idx, { qty: undefined });
                                    } else {
                                      updateMed(idx, { qty: Number(v) });
                                    }
                                  }}
                                  placeholder="0"
                                  className={`w-full px-3 py-2 border rounded-lg outline-none text-sm focus:ring-2 ${
                                    (m.qty ?? 0) > getAvail(m.name)
                                      ? 'border-red-400 focus:ring-red-500 focus:border-red-500'
                                      : 'border-gray-300 focus:ring-emerald-500 focus:border-emerald-500'
                                  }`}
                                />
                                {(() => {
                                  const avail = getAvail(m.name);
                                  const qty = m.qty ?? 0;
                                  const exceeds = qty > avail;
                                  const sisa = Math.max(0, avail - qty);
                                  const text = qty > 0 ? `Sisa stok: ${sisa}` : `Stok tersedia: ${avail}`;
                                  return (
                                    <div className={`mt-1 text-xs ${exceeds ? 'text-red-600' : 'text-gray-600'}`}>
                                      {exceeds ? `Jumlah melebihi stok (stok: ${avail})` : text}
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => { setShowEditRecordModal(false); setEditIndex(null); }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-gray-700"
              >
                Batal
              </button>
              <button
                disabled={qtyExceedsStock}
                onClick={async () => {
                  if (!selectedPatient || editIndex === null) return;
                  const tindakanPrice = procPriceByName[(recAction || '').toLowerCase()] ?? 0;
                  const medsTotal = selectedMeds
                    .filter((m) => (m.qty ?? 0) > 0)
                    .reduce((sum, m) => sum + (resolveMedPrice(m.name) || 0) * (m.qty ?? 0), 0);
                  const computedCost = tindakanPrice + medsTotal;
                  const updated: Patient['records'][number] = {
                    recordId: combinedRecords[editIndex].recordId,
                    date: recDate,
                    poli: recPoli,
                    doctor: recDoctor,
                    diagnosis: recDiagnosis || '-',
                    action: recAction || '-',
                    complaint: recComplaint || '-',
                    medications: selectedMeds,
                    status: combinedRecords[editIndex].status,
                    cost: computedCost,
                    paidAmount: combinedRecords[editIndex].paidAmount,
                  };
                  setEditOverrides((prev) => {
                    const map = prev[selectedPatient.nrm] || {};
                    return { ...prev, [selectedPatient.nrm]: { ...map, [editIndex]: updated } };
                  });
                  if (supabase) {
                    try {
                      let poliId: string | null = null;
                      let doctorId: string | null = null;
                      const { data: poliRow } = await supabase
                        .from('polies')
                        .select('id')
                        .eq('name', recPoli)
                        .limit(1)
                        .maybeSingle();
                      if (!poliRow) {
                        const { data: insertedPoli } = await supabase
                          .from('polies')
                          .insert({ name: recPoli })
                          .select('id')
                          .single();
                        poliId = insertedPoli?.id ?? null;
                      } else {
                        poliId = poliRow.id;
                      }
                      if (recDoctor && recDoctor.trim().length > 0) {
                        const { data: doctorRow } = await supabase
                          .from('doctors')
                          .select('id')
                          .eq('name', recDoctor)
                          .limit(1)
                          .maybeSingle();
                        if (!doctorRow) {
                          const { data: insertedDoctor } = await supabase
                            .from('doctors')
                            .insert({ name: recDoctor, poli_id: poliId })
                            .select('id')
                            .single();
                          doctorId = insertedDoctor?.id ?? null;
                        } else {
                          doctorId = doctorRow.id;
                        }
                      } else {
                        doctorId = null;
                      }
                      const { data: pRow } = await supabase
                        .from('patients')
                        .select('id')
                        .eq('nrm', selectedPatient.nrm)
                        .limit(1)
                        .maybeSingle();
                      const patientId = pRow?.id ?? null;
                      if (patientId) {
                        let recordId = combinedRecords[editIndex].recordId || null;
                        if (!recordId) {
                          const { data: recRow } = await supabase
                            .from('medical_records')
                            .select('id,date')
                            .eq('patient_id', patientId)
                            .eq('date', combinedRecords[editIndex].date)
                            .order('updated_at', { ascending: false })
                            .limit(1)
                            .maybeSingle();
                          recordId = recRow?.id ?? null;
                        }
                        if (recordId) {
                          await supabase
                            .from('medical_records')
                            .update({
                              date: recDate,
                              poli_id: poliId,
                              doctor_id: doctorId,
                              diagnosis: recDiagnosis || '-',
                              action: recAction || '-',
                              complaint: recComplaint || '-',
                              cost: computedCost,
                            })
                            .eq('id', recordId);
                          const names = selectedMeds.map((m) => m.name);
                          const { data: existingDrugs } = await supabase
                            .from('drugs')
                            .select('id,name')
                            .in('name', names);
                          const mapId = new Map<string, string>();
                          (existingDrugs || []).forEach((d: { id: string; name: string }) => mapId.set(d.name, d.id));
                          const missingNames = names.filter((n) => !mapId.has(n));
                          if (missingNames.length > 0) {
                            const { data: insertedDrugs } = await supabase
                              .from('drugs')
                              .insert(
                                missingNames.map((n) => {
                                  const unitGuess = selectedMeds.find((m) => m.name === n)?.unit || 'Unit';
                                  return { name: n, unit: unitGuess, price: resolveMedPrice(n) || 0, min_stock: 0 };
                                })
                              )
                              .select('id,name');
                            (insertedDrugs || []).forEach((d: { id: string; name: string }) => mapId.set(d.name, d.id));
                          }
                          const { data: existingMRM } = await supabase
                            .from('medical_record_medications')
                            .select('id,drug_id,qty')
                            .eq('record_id', recordId);
                          const existingByDrug = new Map<string, { id: string; qty: number }>();
                          (existingMRM || []).forEach((row: { id: string; drug_id?: string | null; qty?: number | null }) => {
                            if (row.drug_id) existingByDrug.set(row.drug_id, { id: row.id, qty: Number(row.qty ?? 0) });
                          });
                          const targetDrugIds = selectedMeds
                            .filter((m) => (m.qty ?? 0) > 0)
                            .map((m) => mapId.get(m.name))
                            .filter(Boolean) as string[];
                          const removed = Array.from(existingByDrug.keys()).filter((id) => !targetDrugIds.includes(id));
                          if (removed.length > 0) {
                            // Set qty to 0 for removed meds (soft removal)
                            await supabase
                              .from('medical_record_medications')
                              .update({ qty: 0 })
                              .eq('record_id', recordId)
                              .in('drug_id', removed);
                          }
                          // Upsert-like: update if exists, else insert
                          for (const m of selectedMeds.filter((m) => (m.qty ?? 0) > 0)) {
                            const drugId = mapId.get(m.name);
                            if (!drugId) continue;
                            const existing = existingByDrug.get(drugId);
                            const payload = {
                              dose: m.dose || null,
                              qty: m.qty ?? 0,
                              unit: m.unit || null,
                              price: resolveMedPrice(m.name) || 0,
                            };
                            if (existing) {
                              await supabase
                                .from('medical_record_medications')
                                .update(payload)
                                .eq('id', existing.id);
                            } else {
                              await supabase
                                .from('medical_record_medications')
                                .insert({
                                  record_id: recordId,
                                  drug_id: drugId,
                                  ...payload,
                                });
                            }
                          }
                        }
                      }
                    } catch (err) {
                      console.error('Supabase error', err);
                    }
                  }
                  setShowEditRecordModal(false);
                  setEditIndex(null);
                }}
                className={`flex-1 px-4 py-2 rounded-lg transition-colors font-medium ${
                  qtyExceedsStock ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-700'
                }`}
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-800">Tambah Pasien Baru</h2>
            </div>

            <div className="p-6">
              <div className="mb-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Data Pasien</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nama Lengkap
                    </label>
                    <input
                      type="text"
                      value={addName}
                      onChange={(e) => setAddName(e.target.value)}
                      placeholder="Nama pasien"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tanggal Lahir
                    </label>
                    <input
                      type="date"
                      value={addBirthDate}
                      onChange={(e) => setAddBirthDate(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Jenis Kelamin
                    </label>
                    <div className="flex items-center gap-6">
                      <label className="inline-flex items-center gap-2 text-gray-800">
                        <input
                          type="radio"
                          name="gender"
                          value="male"
                          checked={addGender === 'male'}
                          onChange={(e) => setAddGender(e.target.value)}
                          className="text-emerald-600 focus:ring-emerald-500"
                        />
                        <span>Pria</span>
                      </label>
                      <label className="inline-flex items-center gap-2 text-gray-800">
                        <input
                          type="radio"
                          name="gender"
                          value="female"
                          checked={addGender === 'female'}
                          onChange={(e) => setAddGender(e.target.value)}
                          className="text-emerald-600 focus:ring-emerald-500"
                        />
                        <span>Wanita</span>
                      </label>
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Alamat
                    </label>
                    <textarea
                      rows={2}
                      value={addAddress}
                      onChange={(e) => setAddAddress(e.target.value)}
                      placeholder="Alamat lengkap"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      No. Telepon
                    </label>
                    <input
                      type="tel"
                      value={addPhone}
                      onChange={(e) => setAddPhone(e.target.value)}
                      placeholder="08xxxxxxxxxx"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      value={addEmail}
                      onChange={(e) => setAddEmail(e.target.value)}
                      placeholder="email@example.com"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Kontak Darurat</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nama Orang Tua/Wali
                  </label>
                  <input
                    type="text"
                    value={addParentName}
                    onChange={(e) => setAddParentName(e.target.value)}
                    placeholder="Nama orang tua/wali"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      No. Telepon
                    </label>
                    <input
                      type="tel"
                      value={addParentPhone}
                      onChange={(e) => setAddParentPhone(e.target.value)}
                      placeholder="08xxxxxxxxxx"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      value={addParentEmail}
                      onChange={(e) => setAddParentEmail(e.target.value)}
                      placeholder="email@example.com"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    />
                  </div>
                </div>
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
                onClick={async () => {
                  const name = addName.trim();
                  if (!name) {
                    alert('Nama wajib diisi');
                    return;
                  }
                  if (!supabase) {
                    alert('Koneksi database tidak tersedia');
                    return;
                  }
                  // Generate NRM otomatis: format NRM-<YYYY><seq>
                  const year = new Date().getFullYear();
                  let seq = 1;
                  try {
                    const res = await supabase
                      .from('patients')
                      .select('nrm', { count: 'exact' })
                      .ilike('nrm', `NRM-${year}%`)
                      .is('deleted_at', null)
                      .limit(1);
                    const cnt = (res as { count: number | null } | null)?.count ?? null;
                    if (typeof cnt === 'number') {
                      seq = cnt + 1;
                    } else {
                      const { data: lastRow } = await supabase
                        .from('patients')
                        .select('nrm')
                        .ilike('nrm', `NRM-${year}%`)
                        .is('deleted_at', null)
                        .order('nrm', { ascending: false })
                        .limit(1)
                        .maybeSingle();
                      const suf = lastRow?.nrm?.replace(`NRM-${year}`, '') ?? '';
                      const num = /^\d+$/.test(suf) ? Number(suf) : 0;
                      seq = num + 1 || 1;
                    }
                  } catch {
                    const { data: lastRow } = await supabase
                      .from('patients')
                      .select('nrm')
                      .ilike('nrm', `NRM-${year}%`)
                      .is('deleted_at', null)
                      .order('nrm', { ascending: false })
                      .limit(1)
                      .maybeSingle();
                    const suf = lastRow?.nrm?.replace(`NRM-${year}`, '') ?? '';
                    const num = /^\d+$/.test(suf) ? Number(suf) : 0;
                    seq = num + 1 || 1;
                  }
                  const nrm = `NRM-${year}${String(seq).padStart(3, '0')}`;
                  const payload = {
                    nrm,
                    name,
                    primary_poli_id: null,
                    birth_date: addBirthDate || null,
                    address: addAddress || null,
                    phone: addPhone || null,
                    email: addEmail || null,
                    parent_name: addParentName || null,
                    parent_phone: addParentPhone || null,
                    parent_email: addParentEmail || null,
                  };
                  const { error } = await supabase.from('patients').insert(payload);
                  if (error) {
                    alert(`Gagal menyimpan pasien: ${error.message}`);
                    return;
                  }
                  setAddedPatients((prev) => [
                    ...prev,
                    {
                      id: Date.now(),
                      name,
                      nrm,
                      poli: 'Umum',
                      birthDate: addBirthDate || '',
                      address: addAddress || '',
                      phone: addPhone || '',
                      email: addEmail || '',
                      parentName: addParentName || '',
                      parentPhone: addParentPhone || '',
                      parentEmail: addParentEmail || '',
                      records: [],
                    },
                  ]);
                  setShowAddModal(false);
                  setAddName('');
                  setAddBirthDate('');
                  setAddGender('');
                  setAddAddress('');
                  setAddPhone('');
                  setAddEmail('');
                  setAddParentName('');
                  setAddParentPhone('');
                  setAddParentEmail('');
                }}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddRecordModal && selectedPatient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto mx-4">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-800">Input Rekam Medis</h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Kolom kiri: data pemeriksaan */}
                <div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Tanggal</label>
                    <input
                      type="date"
                      value={recDate}
                      onChange={(e) => setRecDate(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Poli</label>
                      <select
                        value={recPoli}
                        onChange={(e) => setRecPoli(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      >
                        {poliOptions.length === 0 ? <option>Memuat...</option> : poliOptions.map((p) => (<option key={p.id} value={p.name}>{p.name}</option>))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Dokter</label>
                      <select
                        value={recDoctor}
                        onChange={(e) => setRecDoctor(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      >
                        {(() => {
                          const selectedPoliId = poliOptions.find((p) => p.name === recPoli)?.id;
                          let docList = selectedPoliId ? doctorOptions.filter((d) => d.poli_id === selectedPoliId) : doctorOptions;
                          if (docList.length === 0) docList = doctorOptions;
                          if (docList.length === 0) return <option>Tidak ada dokter</option>;
                          return docList.map((d) => (<option key={d.id} value={d.name}>{d.name}</option>));
                        })()}
                      </select>
                    </div>
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Keluhan</label>
                    <textarea
                      rows={4}
                      placeholder="Keluhan utama..."
                      value={recComplaint}
                      onChange={(e) => setRecComplaint(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none"
                    />
                  </div>
                  <div className="mb-4 relative">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Diagnosa</label>
                    <textarea
                      rows={3}
                      placeholder="Diagnosa"
                      value={recDiagnosis}
                      onChange={(e) => setRecDiagnosis(e.target.value)}
                      onFocus={() => setShowDiagSuggest(true)}
                      onClick={() => setShowDiagSuggest(true)}
                      onBlur={() => {
                        setTimeout(() => setShowDiagSuggest(false), 120);
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none"
                    />
                    {showDiagSuggest && (
                      <div className="absolute left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-auto z-10">
                        {(recDiagnosis.trim().length >= 2
                          ? diagOptions.filter(
                              (d) =>
                                d.name.toLowerCase().includes(recDiagnosis.trim().toLowerCase()) ||
                                (d.code ?? '').toLowerCase().includes(recDiagnosis.trim().toLowerCase())
                            )
                          : diagOptions.slice(0, 10)
                        )
                          .slice(0, 10)
                          .map((d) => (
                            <button
                              key={`${d.code ?? ''}-${d.name}`}
                              type="button"
                              onClick={() => {
                                setRecDiagnosis(d.name);
                                setShowDiagSuggest(false);
                              }}
                              className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm text-gray-800"
                            >
                              {(d.code ? `${d.code} • ` : '') + d.name}
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                  <div className="mb-4 relative">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Tindakan</label>
                    <input
                      type="text"
                      placeholder="Tindakan"
                      value={recAction}
                      onChange={(e) => setRecAction(e.target.value)}
                      onFocus={() => setShowTindakanSuggest(true)}
                      onClick={() => setShowTindakanSuggest(true)}
                      onBlur={() => {
                        setTimeout(() => setShowTindakanSuggest(false), 120);
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    />
                    {showTindakanSuggest && (
                      <div className="absolute left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-auto z-10">
                        {(recAction.trim().length >= 2
                          ? tindakanOptions.filter(
                              (t) =>
                                t.name.toLowerCase().includes(recAction.trim().toLowerCase()) ||
                                (t.code ?? '').toLowerCase().includes(recAction.trim().toLowerCase())
                            )
                          : tindakanOptions.slice(0, 10)
                        )
                          .slice(0, 10)
                          .map((t) => (
                            <button
                              key={`${t.code ?? ''}-${t.name}`}
                              type="button"
                              onClick={() => {
                                setRecAction(t.name);
                                setShowTindakanSuggest(false);
                              }}
                              className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm text-gray-800"
                            >
                              {(t.code ? `${t.code} • ` : '') + t.name}
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
                {/* Kolom kanan: penginputan obat */}
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Obat</label>
                  <input
                    type="text"
                    value={medQuery}
                    onChange={(e) => setMedQuery(e.target.value)}
                    placeholder="Cari obat, lalu pilih untuk menambahkan (bisa multiple)"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                  {medQuery.length >= 2 && (
                    <div className="absolute left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-auto z-10">
                      {medOptions
                        .filter((m) => m.name.toLowerCase().includes(medQuery.toLowerCase()))
                        .filter((m) => !selectedMeds.some((s) => s.name === m.name))
                        .slice(0, 10)
                        .map((m) => (
                          <button
                            key={m.name}
                            type="button"
                            onClick={() => {
                              addMed(m);
                              setMedQuery('');
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm text-gray-800"
                          >
                            {m.name}{m.dose ? ` ${m.dose}` : ''}{m.unit ? ` • ${m.unit}` : ''}
                          </button>
                        ))}
                    </div>
                  )}
                  <div className="mt-3 max-h-[60vh] overflow-y-auto pr-1">
                    {selectedMeds.length === 0 ? (
                      <div className="text-sm text-gray-600">Belum ada obat dipilih</div>
                    ) : (
                      <div className="space-y-3">
                        {selectedMeds.map((m, idx) => (
                          <div key={m.name} className="p-3 border border-gray-200 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-2 px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-xs">
                                  {m.name}{m.dose ? ` ${m.dose}` : ''}{m.unit ? ` • ${m.unit}` : ''}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeMed(idx)}
                                className="text-red-600 text-xs px-2 py-1 border border-red-300 rounded hover:bg-red-50"
                              >
                                Hapus
                              </button>
                            </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div className="md:col-span-3">
                                <label className="block text-xs font-medium text-gray-700 mb-1">Jumlah</label>
                                <input
                                  type="number"
                                  min={0}
                                  value={m.qty === undefined ? '' : String(m.qty)}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    if (v === '') {
                                      updateMed(idx, { qty: undefined });
                                    } else {
                                      updateMed(idx, { qty: Number(v) });
                                    }
                                  }}
                                  placeholder="0"
                                  className={`w-full px-3 py-2 border rounded-lg outline-none text-sm focus:ring-2 ${
                                    (m.qty ?? 0) > getAvail(m.name)
                                      ? 'border-red-400 focus:ring-red-500 focus:border-red-500'
                                      : 'border-gray-300 focus:ring-emerald-500 focus:border-emerald-500'
                                  }`}
                                />
                                {(() => {
                                  const avail = getAvail(m.name);
                                  const qty = m.qty ?? 0;
                                  const exceeds = qty > avail;
                                  const sisa = Math.max(0, avail - qty);
                                  const text = qty > 0 ? `Sisa stok: ${sisa}` : `Stok tersedia: ${avail}`;
                                  return (
                                    <div className={`mt-1 text-xs ${exceeds ? 'text-red-600' : 'text-gray-600'}`}>
                                      {exceeds ? `Jumlah melebihi stok (stok: ${avail})` : text}
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => setShowAddRecordModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-gray-700"
              >
                Batal
              </button>
              <button
                disabled={qtyExceedsStock}
                onClick={async () => {
                  const newRec: Patient['records'][number] = {
                    createdAt: new Date().toISOString(),
                    date: recDate,
                    poli: recPoli,
                    doctor: recDoctor,
                    diagnosis: recDiagnosis || '-',
                    action: recAction || '-',
                    complaint: recComplaint || '-',
                    medications: selectedMeds,
                    status: 'in_progress',
                    cost: (() => {
                      const tindakanPrice = procPriceByName[(recAction || '').toLowerCase()] ?? 0;
                      const medsTotal = selectedMeds
                        .filter((m) => (m.qty ?? 0) > 0)
                        .reduce((sum, m) => sum + (resolveMedPrice(m.name) || 0) * (m.qty ?? 0), 0);
                      return tindakanPrice + medsTotal;
                    })(),
                    paidAmount: 0,
                  };
                  if (supabase && selectedPatient) {
                    try {
                      let poliId: string | null = null;
                      let doctorId: string | null = null;
                      const { data: poliRow } = await supabase
                        .from('polies')
                        .select('id')
                        .eq('name', recPoli)
                        .limit(1)
                        .single();
                      if (!poliRow) {
                        const { data: insertedPoli } = await supabase
                          .from('polies')
                          .insert({ name: recPoli })
                          .select('id')
                          .single();
                        poliId = insertedPoli?.id ?? null;
                      } else {
                        poliId = poliRow.id;
                      }
                      if (recDoctor && recDoctor.trim().length > 0) {
                        const { data: doctorRow } = await supabase
                          .from('doctors')
                          .select('id')
                          .eq('name', recDoctor)
                          .limit(1)
                          .single();
                        if (!doctorRow) {
                          const { data: insertedDoctor } = await supabase
                            .from('doctors')
                            .insert({ name: recDoctor, poli_id: poliId })
                            .select('id')
                            .single();
                          doctorId = insertedDoctor?.id ?? null;
                        } else {
                          doctorId = doctorRow.id;
                        }
                      } else {
                        doctorId = null;
                      }
                      const { data: pRow } = await supabase
                        .from('patients')
                        .select('id')
                        .eq('nrm', selectedPatient.nrm)
                        .limit(1)
                        .maybeSingle();
                      let patientId: string | null = pRow?.id ?? null;
                      if (!patientId) {
                        const { data: insertedPatient } = await supabase
                          .from('patients')
                          .insert({
                            nrm: selectedPatient.nrm,
                            name: selectedPatient.name,
                            primary_poli_id: poliId,
                            birth_date: selectedPatient.birthDate || null,
                            address: selectedPatient.address || null,
                            phone: selectedPatient.phone || null,
                            email: selectedPatient.email || null,
                            parent_name: selectedPatient.parentName || null,
                            parent_phone: selectedPatient.parentPhone || null,
                            parent_email: selectedPatient.parentEmail || null,
                          })
                          .select('id')
                          .single();
                        patientId = insertedPatient?.id ?? null;
                      }
                      if (patientId) {
                        const { data: recordRow, error: eRec } = await supabase
                          .from('medical_records')
                          .insert({
                            patient_id: patientId,
                            date: recDate,
                            poli_id: poliId,
                            doctor_id: doctorId,
                            diagnosis: recDiagnosis || '-',
                            action: recAction || '-',
                            complaint: recComplaint || '-',
                            status: 'in_progress',
                            cost: (() => {
                              const tindakanPrice = procPriceByName[(recAction || '').toLowerCase()] ?? 0;
                              const medsTotal = selectedMeds
                                .filter((m) => (m.qty ?? 0) > 0)
                                .reduce((sum, m) => sum + (resolveMedPrice(m.name) || 0) * (m.qty ?? 0), 0);
                              return tindakanPrice + medsTotal;
                            })(),
                            paid_amount: 0,
                          })
                          .select('id')
                          .single();
                        if (!eRec && recordRow) {
                          const names = selectedMeds.map((m) => m.name);
                          const { data: existingDrugs } = await supabase
                            .from('drugs')
                            .select('id,name')
                            .in('name', names);
                          const mapId = new Map<string, string>();
                          (existingDrugs || []).forEach((d: { id: string; name: string }) => mapId.set(d.name, d.id));
                          const missingNames = names.filter((n) => !mapId.has(n));
                          if (missingNames.length > 0) {
                            const { data: insertedDrugs } = await supabase
                              .from('drugs')
                              .insert(
                                missingNames.map((n) => {
                                  const unitGuess = selectedMeds.find((m) => m.name === n)?.unit || 'Unit';
                                  return { name: n, unit: unitGuess, price: resolveMedPrice(n) || 0, min_stock: 0 };
                                })
                              )
                              .select('id,name');
                            (insertedDrugs || []).forEach((d: { id: string; name: string }) => mapId.set(d.name, d.id));
                          }
                          const medPayload = selectedMeds
                            .filter((m) => (m.qty ?? 0) > 0)
                            .map((m) => {
                              const drugId = mapId.get(m.name);
                              if (!drugId) return null;
                              return {
                                record_id: recordRow.id,
                                drug_id: drugId,
                                dose: m.dose || null,
                                qty: m.qty ?? 0,
                                unit: m.unit || null,
                                price: resolveMedPrice(m.name) || 0,
                              };
                            })
                            .filter(Boolean) as {
                            record_id: string;
                            drug_id: string;
                            dose: string | null;
                            qty: number;
                            unit: string | null;
                            price: number;
                          }[];
                          if (medPayload.length > 0) {
                            await supabase.from('medical_record_medications').insert(medPayload);
                          }
                          setExtraRecords((prev) => {
                            const arr = prev[selectedPatient.nrm] || [];
                            const recWithId = { ...newRec, recordId: recordRow.id };
                            return { ...prev, [selectedPatient.nrm]: [...arr, recWithId] };
                          });
                        }
                      }
                    } catch (err) {
                      console.error('Supabase error', err);
                    }
                  }
                  if (onConsumeMeds) {
                    onConsumeMeds(selectedMeds.filter((m) => (m.qty ?? 0) > 0));
                  }
                  setShowAddRecordModal(false);
                }}
                className={`flex-1 px-4 py-2 rounded-lg transition-colors font-medium ${
                  qtyExceedsStock ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-700'
                }`}
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
      {showRecordDetailModal && selectedPatient && detailIndex !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl mx-4">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-800">Detail Rekam Medis</h2>
              <span className="text-sm text-gray-500">ID: {selectedPatient.nrm}-{detailIndex + 1}</span>
            </div>
            <div className="p-6 space-y-6">
              {(() => {
                const rec = combinedRecords[detailIndex];
                const meds = rec.medications.filter((m) => (m.qty ?? 0) > 0);
                const sisa = rec.cost - rec.paidAmount;
                return (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs text-gray-500">Tanggal</div>
                        <div className="text-sm font-medium text-gray-800">{rec.date}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Poli / Dokter</div>
                        <div className="text-sm font-medium text-gray-800">
                          <span className="block md:inline">{rec.poli}</span>
                          <span className="hidden md:inline mx-1">•</span>
                          <span className="block md:inline text-gray-600">{rec.doctor}</span>
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Keluhan</div>
                        <div className="text-sm font-medium text-gray-800">{rec.complaint || '-'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Diagnosa</div>
                        <div className="text-sm font-medium text-gray-800">{rec.diagnosis}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Tindakan</div>
                        <div className="text-sm font-medium text-gray-800">{rec.action}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Ringkasan Biaya</div>
                        <div className="text-sm text-right space-y-1">
                          <div className="font-bold text-amber-600">Biaya: {formatCurrency(rec.cost)}</div>
                          <div className="font-semibold text-emerald-600">Terbayar: {formatCurrency(rec.paidAmount)}</div>
                          <div className="font-semibold text-red-600">Sisa: {formatCurrency(sisa)}</div>
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Pill className="w-4 h-4 text-amber-600" />
                        <span className="text-sm font-semibold text-gray-800">Obat</span>
                      </div>
                      <div className="space-y-2">
                        {meds.length === 0 ? (
                          <span className="text-sm text-gray-600">Tidak ada obat</span>
                        ) : (
                          meds.map((m, i) => (
                            <div key={i} className="flex items-center gap-2 px-3 py-2 bg-amber-50 rounded-lg text-xs text-amber-700">
                              <span className="font-medium">{m.name}</span>
                              {m.dose && <span>• {m.dose}</span>}
                              <span>• {m.qty}{m.unit && ` ${m.unit}`}</span>
                              {m.price ? <span>• {formatCurrency(m.price)}</span> : null}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => { setShowRecordDetailModal(false); setDetailIndex(null); }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-gray-700"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
      {showBillingModal && selectedPatient && billIndex !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-800">Pembayaran Rekam Medis</h2>
            </div>
            <div className="p-6 space-y-4">
              {(() => {
                const rec = combinedRecords[billIndex];
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
                        <p className="font-medium text-gray-800">{selectedPatient.name}</p>
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
                          <td className="py-3 px-4 text-right text-sm font-semibold text-amber-600">{`Rp ${computedTotal.toLocaleString('id-ID')}`}</td>
                        </tr>
                        <tr>
                          <td className="py-3 px-4 text-sm text-gray-800">Terbayar</td>
                          <td className="py-3 px-4 text-right text-sm text-emerald-700">{`Rp ${(paid).toLocaleString('id-ID')}`}</td>
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
                onClick={() => { setShowBillingModal(false); setBillIndex(null); }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-gray-700"
              >
                Tutup
              </button>
              <button
                onClick={async () => {
                  if (!selectedPatient || billIndex === null) return;
                  const rec = combinedRecords[billIndex];
                  const total = actionPriceEdit + rec.medications.reduce((sum, m, i) => sum + (medPriceEdits[i] ?? 0) * (m.qty ?? 0), 0);
                  const addPaid = Math.max(0, payNow);
                  const nextPaid = (rec.paidAmount ?? 0) + addPaid;
                  const nextStatus: Patient['records'][number]['status'] = nextPaid >= total ? 'completed' : 'in_progress';
                  if (supabase) {
                    try {
                      const { data: pRow } = await supabase
                        .from('patients')
                        .select('id')
                        .eq('nrm', selectedPatient.nrm)
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
                        await supabase
                          .from('medical_records')
                          .update({
                            cost: total,
                            paid_amount: nextPaid,
                            status: nextStatus,
                          })
                          .eq('id', recordId);
                        if (patientId) {
                          await supabase
                            .from('invoices')
                            .upsert(
                              {
                                medical_record_id: recordId,
                                patient_id: patientId,
                                total_cost: total,
                                paid_amount: nextPaid,
                                status: nextStatus === 'completed' && total > 0 ? 'paid' : 'partial',
                              },
                              { onConflict: 'medical_record_id' }
                            );
                        }
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
                  setEditOverrides((prev) => {
                    const map = prev[selectedPatient.nrm] || {};
                    const nextRec = {
                      ...rec,
                      cost: total,
                      paidAmount: nextPaid,
                      status: nextStatus,
                      medications: rec.medications.map((m, i) => ({ ...m, price: medPriceEdits[i] ?? 0 })),
                    };
                    return { ...prev, [selectedPatient.nrm]: { ...map, [billIndex]: nextRec } };
                  });
                  setShowBillingModal(false);
                  setBillIndex(null);
                }}
                className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-medium"
              >
                Bayar
              </button>
            </div>
          </div>
        </div>
      )}
      {showEditPatientModal && selectedPatient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-800">Ubah Data Pasien</h2>
            </div>
            <div className="p-6">
              <div className="mb-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Data Pasien</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Nama Lengkap</label>
                    <input
                      type="text"
                      value={patientNameEdit}
                      onChange={(e) => setPatientNameEdit(e.target.value)}
                      placeholder="Nama pasien"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Tanggal Lahir</label>
                    <input
                      type="date"
                      value={patientBirthDateEdit}
                      onChange={(e) => setPatientBirthDateEdit(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Jenis Kelamin</label>
                    <div className="flex items-center gap-6">
                      <label className="inline-flex items-center gap-2 text-gray-800">
                        <input
                          type="radio"
                          name="gender-edit"
                          value="male"
                          checked={patientGenderEdit === 'male'}
                          onChange={(e) => setPatientGenderEdit(e.target.value)}
                          className="text-emerald-600 focus:ring-emerald-500"
                        />
                        <span>Pria</span>
                      </label>
                      <label className="inline-flex items-center gap-2 text-gray-800">
                        <input
                          type="radio"
                          name="gender-edit"
                          value="female"
                          checked={patientGenderEdit === 'female'}
                          onChange={(e) => setPatientGenderEdit(e.target.value)}
                          className="text-emerald-600 focus:ring-emerald-500"
                        />
                        <span>Wanita</span>
                      </label>
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Alamat</label>
                    <textarea
                      rows={2}
                      value={patientAddressEdit}
                      onChange={(e) => setPatientAddressEdit(e.target.value)}
                      placeholder="Alamat lengkap"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">No. Telepon</label>
                    <input
                      type="tel"
                      value={patientPhoneEdit}
                      onChange={(e) => setPatientPhoneEdit(e.target.value)}
                      placeholder="08xxxxxxxxxx"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                    <input
                      type="email"
                      value={patientEmailEdit}
                      onChange={(e) => setPatientEmailEdit(e.target.value)}
                      placeholder="email@example.com"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    />
                  </div>
                </div>
              </div>
              <div className="mb-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Kontak Darurat</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Nama Orang Tua/Wali</label>
                    <input
                      type="text"
                      value={patientParentNameEdit}
                      onChange={(e) => setPatientParentNameEdit(e.target.value)}
                      placeholder="Nama orang tua/wali"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">No. Telepon</label>
                    <input
                      type="tel"
                      value={patientParentPhoneEdit}
                      onChange={(e) => setPatientParentPhoneEdit(e.target.value)}
                      placeholder="08xxxxxxxxxx"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                    <input
                      type="email"
                      value={patientParentEmailEdit}
                      onChange={(e) => setPatientParentEmailEdit(e.target.value)}
                      placeholder="email@example.com"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => { setShowEditPatientModal(false); }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-gray-700"
              >
                Batal
              </button>
              <button
                onClick={async () => {
                  if (!selectedPatient) return;
                  if (supabase) {
                    try {
                      const { data: pRow } = await supabase
                        .from('patients')
                        .select('id')
                        .eq('nrm', selectedPatient.nrm)
                        .limit(1)
                        .maybeSingle();
                      const patientId = pRow?.id ?? null;
                      if (patientId) {
                        await supabase
                          .from('patients')
                          .update({
                            name: patientNameEdit,
                            birth_date: patientBirthDateEdit || null,
                            phone: patientPhoneEdit || null,
                            address: patientAddressEdit || null,
                            email: patientEmailEdit || null,
                            parent_name: patientParentNameEdit || null,
                            parent_phone: patientParentPhoneEdit || null,
                            parent_email: patientParentEmailEdit || null,
                          })
                          .eq('id', patientId);
                      }
                    } catch (err) {
                      console.error('Supabase error', err);
                    }
                  }
                  setSelectedPatient((prev) => prev ? {
                    ...prev,
                    name: patientNameEdit,
                    birthDate: patientBirthDateEdit || prev.birthDate,
                    phone: patientPhoneEdit || prev.phone,
                    address: patientAddressEdit || prev.address,
                    email: patientEmailEdit || prev.email,
                    parentName: patientParentNameEdit || prev.parentName,
                    parentPhone: patientParentPhoneEdit || prev.parentPhone,
                    parentEmail: patientParentEmailEdit || prev.parentEmail,
                  } : prev);
                  setShowEditPatientModal(false);
                }}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
      {showDeleteConfirmModal && selectedPatient && deleteIndex !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-800">Hapus Rekam Medis</h2>
            </div>
            <div className="p-6 space-y-4">
              {(() => {
                const rec = combinedRecords[deleteIndex];
                return (
                  <>
                    <p className="text-sm text-gray-700">
                      Anda yakin ingin menghapus rekam medis ini? Tindakan ini tidak dapat dibatalkan.
                    </p>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">Tanggal</p>
                        <p className="font-medium text-gray-800">{rec.date}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Dokter</p>
                        <p className="font-medium text-gray-800">{rec.doctor}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Poli</p>
                        <p className="font-medium text-gray-800">{rec.poli}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Pasien</p>
                        <p className="font-medium text-gray-800">{selectedPatient.name}</p>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => { setShowDeleteConfirmModal(false); setDeleteIndex(null); }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-gray-700"
              >
                Batal
              </button>
              <button
                onClick={async () => {
                  if (!selectedPatient || deleteIndex === null) return;
                  const rec0 = combinedRecords[deleteIndex];
                  if (supabase) {
                    try {
                      const { data: pRow } = await supabase
                        .from('patients')
                        .select('id')
                        .eq('nrm', selectedPatient.nrm)
                        .limit(1)
                        .maybeSingle();
                      const patientId = pRow?.id ?? null;
                      let recordId = rec0.recordId || null;
                      if (!recordId && patientId) {
                        const { data: recRow } = await supabase
                          .from('medical_records')
                          .select('id')
                          .eq('patient_id', patientId)
                          .eq('date', rec0.date)
                          .order('updated_at', { ascending: false })
                          .limit(1)
                          .maybeSingle();
                        recordId = recRow?.id ?? null;
                      }
                      if (recordId) {
                        await supabase
                          .from('medical_record_medications')
                          .delete()
                          .eq('record_id', recordId);
                        const { data: delRows } = await supabase
                          .from('medical_records')
                          .delete()
                          .eq('id', recordId)
                          .select('id');
                        if (!delRows || (Array.isArray(delRows) && delRows.length === 0)) {
                          await supabase
                            .from('medical_records')
                            .update({ deleted_at: new Date().toISOString() })
                            .eq('id', recordId);
                        }
                      }
                    } catch (err) {
                      console.error('Supabase error', err);
                    }
                  }
                  const baseLen = selectedPatient.records.length;
                  if (deleteIndex >= baseLen) {
                    setExtraRecords((prev) => {
                      const arr = prev[selectedPatient.nrm] || [];
                      const localIdx = deleteIndex - baseLen;
                      const nextArr = arr.filter((_, i) => i !== localIdx);
                      return { ...prev, [selectedPatient.nrm]: nextArr };
                    });
                  } else {
                    setSelectedPatient((prev) =>
                      prev
                        ? { ...prev, records: prev.records.filter((_, i) => i !== deleteIndex) }
                        : prev
                    );
                  }
                  setShowDeleteConfirmModal(false);
                  setDeleteIndex(null);
                }}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
