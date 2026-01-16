import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Dashboard from './components/Dashboard';
import Pendaftaran from './components/Income';
import PemeriksaanRajal from './components/Expense';
import Reports from './components/Reports';
import Patients from './components/Patients';
import FinanceIncome from './components/FinanceIncome';
import FinanceExpense from './components/FinanceExpense';
import MasterPoli from './components/master/MasterPoli';
import MasterDokter from './components/master/MasterDokter';
import MasterObat from './components/master/MasterObat';
import MasterTindakan from './components/master/MasterTindakan';
import MasterDiagnosa from './components/master/MasterDiagnosa';
import MasterAdministrasi from './components/master/MasterAdministrasi';
import MasterPenunjang from './components/master/MasterPenunjang';
import MasterSupplier from './components/master/MasterSupplier';
import MasterKamar from './components/master/MasterKamar';
import MasterAdjustObat from './components/master/MasterAdjustObat';
import Billing from './components/Billing';
import Sidebar from './components/Sidebar';
import Stock from './components/Stock';
import Login from './components/Login';
import Users from './components/Users';
import { supabase } from './lib/supabase';

type Page =
  | 'dashboard'
  | 'users'
  | 'patients'
  | 'pendaftaran'
  | 'pemeriksaan'
  | 'billing'
  | 'stok-obat'
  | 'pemasukan'
  | 'pengeluaran'
  | 'laporan'
  | 'master-poli'
  | 'master-dokter'
  | 'master-obat'
  | 'master-adjust-obat'
  | 'master-tindakan'
  | 'master-diagnosa'
  | 'master-administrasi'
  | 'master-penunjang'
  | 'master-supplier'
  | 'master-kamar'
  | 'login';

// Shared patient/record shape used for Patients & Billing
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

type Batch = { id: string; qty: number; expires?: string };
type InventoryItem = { id: number; name: string; unit: string; supplier?: string; minStock: number; batches: Batch[] };

function App() {
  const [routePath, setRoutePath] = useState<string>('');
 
  const [authUser, setAuthUser] = useState<{ id: string; email: string; full_name?: string; role?: string } | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem('authUser');
      if (raw) {
        setAuthUser(JSON.parse(raw));
      }
    } catch (e) {
      console.error(e);
    }
  }, []);
  const handleLoggedIn = (u: { id: string; email: string; full_name?: string; role?: string }) => {
    setAuthUser(u);
    try {
      localStorage.setItem('authUser', JSON.stringify(u));
    } catch (e) {
      console.error(e);
    }
    navigate('/dashboard');
  };
  const handleLogout = () => {
    setAuthUser(null);
    try {
      localStorage.removeItem('authUser');
    } catch (e) {
      console.error(e);
    }
    navigate('/login');
  };

  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  // DB-backed stock (read-only display)
  const [inventoryDb, setInventoryDb] = useState<InventoryItem[]>([]);
  const uuidNumRef = useRef<Map<string, number>>(new Map());
  const numUuidRef = useRef<Map<number, string>>(new Map());
  const nextIdRef = useRef<number>(1000);
  const [patientsDb, setPatientsDb] = useState<Patient[]>([]);
  const patientUuidNumRef = useRef<Map<string, number>>(new Map());
  const patientNextNumRef = useRef<number>(10000);
  const recordIdMapRef = useRef<Map<string, string>>(new Map());
  const patientIdByNRMRef = useRef<Map<string, string>>(new Map());
  const [registrationsDb, setRegistrationsDb] = useState<Registration[]>([]);
  const regDbIdMapRef = useRef<Map<number, string>>(new Map());
  const poliByIdRef = useRef<Map<string, string>>(new Map());
  const doctorByIdRef = useRef<Map<string, string>>(new Map());
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    (async () => {
      const { data: polies } = await supabase.from('polies').select('id,name');
      const pMap = new Map<string, string>();
      (polies || []).forEach((p) => pMap.set(p.id, p.name));
      const { data: doctors } = await supabase.from('doctors').select('id,name');
      const dMap = new Map<string, string>();
      (doctors || []).forEach((d) => dMap.set(d.id, d.name));
      if (active) {
        poliByIdRef.current = pMap;
        doctorByIdRef.current = dMap;
      }
    })();
    return () => {
      active = false;
    };
  }, []);
  const loadPatients = useCallback(async () => {
    if (!supabase) return;
    const poliName = poliByIdRef.current;
    const doctorName = doctorByIdRef.current;
    const { data: patientsRows } = await supabase
      .from('patients')
      .select('id,nrm,name,primary_poli_id,birth_date,address,phone,email,parent_name,parent_phone,parent_email,updated_at')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false });
    if (!patientsRows) return;
    const patientIdSet = patientsRows.map((p) => p.id);
    const { data: recordsRows } = await supabase
      .from('medical_records')
      .select('id,patient_id,date,poli_id,doctor_id,diagnosis,action,complaint,status,cost,paid_amount,created_at')
      .in('patient_id', patientIdSet)
      .is('deleted_at', null);
    const recordIdSet = (recordsRows || []).map((r) => r.id);
    const { data: mrmRows } =
      recordIdSet.length > 0
        ? await supabase
            .from('medical_record_medications')
            .select('record_id,drug_id,dose,qty,unit,price')
            .in('record_id', recordIdSet)
        : { data: [] as { record_id: string; drug_id?: string | null; dose?: string | null; qty?: number | null; unit?: string | null; price?: number | null }[] };
    const drugIdSet = Array.from(new Set((mrmRows || []).map((m) => m.drug_id).filter(Boolean))) as string[];
    const { data: drugsRows } = drugIdSet.length
      ? await supabase.from('drugs').select('id,name,unit,price').in('id', drugIdSet)
      : { data: [] as { id: string; name: string; unit?: string; price?: number }[] };
    const drugName = new Map<string, { name: string; unit?: string; price?: number }>();
    (drugsRows || []).forEach((d) => drugName.set(d.id, { name: d.name, unit: d.unit, price: d.price }));
    const medsByRecord = new Map<string, { name: string; dose?: string; qty?: number; unit?: string; price?: number }[]>();
    (mrmRows || []).forEach((m) => {
      const info = m.drug_id ? drugName.get(m.drug_id) : undefined;
      const arr = medsByRecord.get(m.record_id) || [];
      if ((m.qty ?? 0) > 0) {
        arr.push({
          name: info?.name || 'Obat',
          dose: m.dose || undefined,
          qty: m.qty || 0,
          unit: m.unit || info?.unit || undefined,
          price: m.price ?? info?.price ?? 0,
        });
      }
      medsByRecord.set(m.record_id, arr);
    });
    const patientsOut: Patient[] = [];
    recordIdMapRef.current.clear();
    patientIdByNRMRef.current.clear();
    patientsRows.forEach((pRow) => {
      let numId = patientUuidNumRef.current.get(pRow.id);
      if (!numId) {
        numId = patientNextNumRef.current++;
        patientUuidNumRef.current.set(pRow.id, numId);
      }
      patientIdByNRMRef.current.set(pRow.nrm, pRow.id);
      const recs = (recordsRows || [])
        .filter((r) => r.patient_id === pRow.id)
        .sort((a, b) => {
          const ad = (a.created_at || a.date);
          const bd = (b.created_at || b.date);
          return bd.localeCompare(ad);
        })
        .map((r, idx) => {
          recordIdMapRef.current.set(`${pRow.nrm}|${idx}`, r.id);
          return {
            recordId: r.id,
            createdAt: r.created_at,
            date: r.date,
            poli: (r.poli_id && poliName.get(r.poli_id)) || (pRow.primary_poli_id && poliName.get(pRow.primary_poli_id)) || 'Umum',
            doctor: (r.doctor_id && doctorName.get(r.doctor_id)) || '-',
            diagnosis: r.diagnosis || '-',
            action: r.action || '-',
            complaint: r.complaint || '-',
            medications: medsByRecord.get(r.id) || [],
            status: r.status,
            cost: Number(r.cost ?? 0),
            paidAmount: Number(r.paid_amount ?? 0),
          };
        });
      patientsOut.push({
        id: numId,
        name: pRow.name,
        nrm: pRow.nrm,
        poli: (pRow.primary_poli_id && poliName.get(pRow.primary_poli_id)) || 'Umum',
        birthDate: pRow.birth_date || '',
        address: pRow.address || '',
        phone: pRow.phone || '',
        email: pRow.email || '',
        parentName: pRow.parent_name || '',
        parentPhone: pRow.parent_phone || '',
        parentEmail: pRow.parent_email || '',
        records: recs,
      });
    });
    setPatientsDb(patientsOut);
  }, []);
  const loadRegistrations = useCallback(async () => {
    if (!supabase) return;
    const { data: regs } = await supabase
      .from('registrations')
      .select('id,date,queue,patient_id,poli_id,doctor_id,complaint,status,updated_at')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false });
    const { data: pats } = await supabase.from('patients').select('id,name,nrm');
    const nameByPid = new Map<string, { name: string; nrm: string }>();
    (pats || []).forEach((p) => nameByPid.set(p.id, { name: p.name, nrm: p.nrm }));
    const { data: polies } = await supabase.from('polies').select('id,name');
    const pName = new Map<string, string>();
    (polies || []).forEach((p) => pName.set(p.id, p.name));
    const { data: docs } = await supabase.from('doctors').select('id,name');
    const dName = new Map<string, string>();
    (docs || []).forEach((d) => dName.set(d.id, d.name));
    const list: Registration[] = (regs || []).map((r, idx) => {
      const localId = idx + 1;
      regDbIdMapRef.current.set(localId, r.id);
      return {
        id: localId,
        date: r.date,
        queue: r.queue,
        patient: { name: nameByPid.get(r.patient_id)?.name || '-', nrm: nameByPid.get(r.patient_id)?.nrm || '-' },
        poli: (r.poli_id && pName.get(r.poli_id)) || 'Umum',
        doctor: (r.doctor_id && dName.get(r.doctor_id)) || '-',
        complaint: r.complaint || '-',
        status: r.status,
      };
    });
    setRegistrationsDb(list);
  }, []);
  const loadInventory = useCallback(async () => {
    if (!supabase) return;
    const { data: vstock } = await supabase.from('v_drug_stock').select('drug_id,name,unit,supplier_name,min_stock');
    const { data: batches } = await supabase
      .from('drug_batches')
      .select('id,drug_id,qty,expires_at,batch_code,deleted_at')
      .is('deleted_at', null);
    if (!vstock || !batches) return;
    const byDrug = new Map<string, Batch[]>();
    for (const b of batches) {
      const arr = byDrug.get(b.drug_id) || [];
      arr.push({
        id: b.batch_code || b.id,
        qty: b.qty ?? 0,
        expires: b.expires_at || undefined,
      });
      byDrug.set(b.drug_id, arr);
    }
    const items: InventoryItem[] = vstock.map((row) => {
      let numId = uuidNumRef.current.get(row.drug_id);
      if (!numId) {
        numId = nextIdRef.current++;
        uuidNumRef.current.set(row.drug_id, numId);
        numUuidRef.current.set(numId, row.drug_id);
      }
      return {
        id: numId,
        name: row.name,
        unit: row.unit,
        supplier: row.supplier_name || undefined,
        minStock: row.min_stock ?? 0,
        batches: (byDrug.get(row.drug_id) || []).sort((a, b) => {
          const ta = a.expires ? new Date(a.expires).getTime() : Number.POSITIVE_INFINITY;
          const tb = b.expires ? new Date(b.expires).getTime() : Number.POSITIVE_INFINITY;
          return ta - tb;
        }),
      };
    });
    setInventoryDb(items);
  }, []);
  useEffect(() => {
    loadInventory();
    return () => {
    };
  }, [loadInventory]);
  useEffect(() => {
    if (!supabase) return;
    const ch = supabase
      .channel('realtime-inventory')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drug_batches' }, async () => {
        const run = async () => {
          if (!supabase) return;
          const { data: vstock } = await supabase.from('v_drug_stock').select('drug_id,name,unit,supplier_name,min_stock');
          const { data: batches } = await supabase
            .from('drug_batches')
            .select('id,drug_id,qty,expires_at,batch_code,deleted_at')
            .is('deleted_at', null);
          if (!vstock || !batches) return;
          const byDrug = new Map<string, Batch[]>();
          for (const b of batches) {
            const arr = byDrug.get(b.drug_id) || [];
            arr.push({ id: b.batch_code || b.id, qty: b.qty ?? 0, expires: b.expires_at || undefined });
            byDrug.set(b.drug_id, arr);
          }
          const items: InventoryItem[] = vstock.map((row) => {
            let numId = uuidNumRef.current.get(row.drug_id);
            if (!numId) {
              numId = nextIdRef.current++;
              uuidNumRef.current.set(row.drug_id, numId);
            }
            return {
              id: numId,
              name: row.name,
              unit: row.unit,
              supplier: row.supplier_name || undefined,
              minStock: row.min_stock ?? 0,
              batches: (byDrug.get(row.drug_id) || []).sort((a, b) => {
                const ta = a.expires ? new Date(a.expires).getTime() : Number.POSITIVE_INFINITY;
                const tb = b.expires ? new Date(b.expires).getTime() : Number.POSITIVE_INFINITY;
                return ta - tb;
              }),
            };
          });
          setInventoryDb(items);
        };
        await run();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drugs' }, async () => {
        if (!supabase) return;
        const { data: vstock } = await supabase.from('v_drug_stock').select('drug_id,name,unit,supplier_name,min_stock');
        const { data: batches } = await supabase
          .from('drug_batches')
          .select('id,drug_id,qty,expires_at,batch_code,deleted_at')
          .is('deleted_at', null);
        if (!vstock || !batches) return;
        const byDrug = new Map<string, Batch[]>();
        for (const b of batches) {
          const arr = byDrug.get(b.drug_id) || [];
          arr.push({ id: b.batch_code || b.id, qty: b.qty ?? 0, expires: b.expires_at || undefined });
          byDrug.set(b.drug_id, arr);
        }
        const items: InventoryItem[] = vstock.map((row) => {
          let numId = uuidNumRef.current.get(row.drug_id);
          if (!numId) {
            numId = nextIdRef.current++;
            uuidNumRef.current.set(row.drug_id, numId);
          }
          return {
            id: numId,
            name: row.name,
            unit: row.unit,
            supplier: row.supplier_name || undefined,
            minStock: row.min_stock ?? 0,
            batches: (byDrug.get(row.drug_id) || []).sort((a, b) => {
              const ta = a.expires ? new Date(a.expires).getTime() : Number.POSITIVE_INFINITY;
              const tb = b.expires ? new Date(b.expires).getTime() : Number.POSITIVE_INFINITY;
              return ta - tb;
            }),
          };
        });
        setInventoryDb(items);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_items' }, async () => {
        if (!supabase) return;
        const { data: vstock } = await supabase.from('v_drug_stock').select('drug_id,name,unit,supplier_name,min_stock');
        const { data: batches } = await supabase
          .from('drug_batches')
          .select('id,drug_id,qty,expires_at,batch_code,deleted_at')
          .is('deleted_at', null);
        if (!vstock || !batches) return;
        const byDrug = new Map<string, Batch[]>();
        for (const b of batches) {
          const arr = byDrug.get(b.drug_id) || [];
          arr.push({ id: b.batch_code || b.id, qty: b.qty ?? 0, expires: b.expires_at || undefined });
          byDrug.set(b.drug_id, arr);
        }
        const items: InventoryItem[] = vstock.map((row) => {
          let numId = uuidNumRef.current.get(row.drug_id);
          if (!numId) {
            numId = nextIdRef.current++;
            uuidNumRef.current.set(row.drug_id, numId);
          }
          return {
            id: numId,
            name: row.name,
            unit: row.unit,
            supplier: row.supplier_name || undefined,
            minStock: row.min_stock ?? 0,
            batches: (byDrug.get(row.drug_id) || []).sort((a, b) => {
              const ta = a.expires ? new Date(a.expires).getTime() : Number.POSITIVE_INFINITY;
              const tb = b.expires ? new Date(b.expires).getTime() : Number.POSITIVE_INFINITY;
              return ta - tb;
            }),
          };
        });
        setInventoryDb(items);
      })
      .subscribe();
    return () => {
      if (supabase) supabase.removeChannel(ch);
    };
  }, []);
  // Realtime: auto refresh registrations list on insert/update/delete
  useEffect(() => {
    if (!supabase) return;
    const chRegs = supabase
      .channel('realtime-registrations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'registrations' }, () => {
        loadRegistrations();
      })
      .subscribe();
    const chMed = supabase
      .channel('realtime-medical-records')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'medical_records' }, () => {
        loadPatients();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'medical_record_medications' }, () => {
        loadPatients();
      })
      .subscribe();
    return () => {
      if (supabase) {
        supabase.removeChannel(chRegs);
        supabase.removeChannel(chMed);
      }
    };
  }, [loadPatients, loadRegistrations]);
  useEffect(() => {
    const fetchPatients = async () => {
      await loadPatients();
    };
    fetchPatients();
    loadRegistrations();
    return () => {
    };
  }, [loadPatients, loadRegistrations]);
  useEffect(() => {
    const path = routePath || '/dashboard';
    const seg = path.split('/').filter(Boolean);
    if (!authUser) return;
    if (seg[0] === 'patients' || seg[0] === 'billing' || seg[0] === 'pendaftaran' || seg[0] === 'pemeriksaan' || seg[0] === 'pemasukan') {
      loadPatients();
      loadRegistrations();
    }
    if (seg[0] === 'pengeluaran' || seg[0] === 'stok-obat') {
      loadInventory();
    }
  }, [routePath, authUser, loadPatients, loadRegistrations, loadInventory]);
  const addStockBatch = (itemId: number, batch: Batch) => {
    if (batch.qty <= 0) return;
    setInventory((prev) =>
      prev.map((it) => (it.id === itemId ? { ...it, batches: [...it.batches, batch] } : it))
    );
  };
  const reduceStockByItemId = (itemId: number, qty: number) => {
    if (qty <= 0) return;
    setInventory((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it;
        let remaining = qty;
        const sorted = [...it.batches].sort((a, b) => {
          const ta = a.expires ? new Date(a.expires).getTime() : Number.POSITIVE_INFINITY;
          const tb = b.expires ? new Date(b.expires).getTime() : Number.POSITIVE_INFINITY;
          return ta - tb;
        });
        const next = sorted
          .map((b) => {
            if (remaining <= 0) return b;
            const take = Math.min(b.qty, remaining);
            remaining -= take;
            return { ...b, qty: b.qty - take };
          })
          .filter((b) => b.qty > 0);
        return { ...it, batches: next };
      })
    );
  };
  const consumeStockByMedUsages = (usages: { name: string; qty: number }[]) => {
    usages.forEach((u) => {
      const item = inventory.find((it) => it.name.toLowerCase() === u.name.toLowerCase());
      if (item) reduceStockByItemId(item.id, u.qty);
    });
  };
  const updateRecordPayment = (nrm: string, recordIndex: number, nextCost: number, nextPaidAmount: number) => {
    if (supabase) {
      const recId = recordIdMapRef.current.get(`${nrm}|${recordIndex}`);
      const pid = patientIdByNRMRef.current.get(nrm);
      if (recId && pid) {
        (async () => {
          const status = nextPaidAmount >= nextCost && nextCost > 0 ? 'completed' : 'in_progress';
          await supabase
            .from('medical_records')
            .update({
              cost: nextCost,
              paid_amount: nextPaidAmount,
              status,
            })
            .eq('id', recId);
          await supabase
            .from('invoices')
            .upsert(
              {
                medical_record_id: recId,
                patient_id: pid,
                total_cost: nextCost,
                paid_amount: nextPaidAmount,
                status: nextPaidAmount >= nextCost && nextCost > 0 ? 'paid' : 'partial',
              },
              { onConflict: 'medical_record_id' }
            );
        })();
      }
    }
    const nextStatus = nextPaidAmount >= nextCost && nextCost > 0 ? 'completed' : 'in_progress';
    setPatientsDb((prev) =>
      prev.map((p) =>
        p.nrm === nrm
          ? {
              ...p,
              records: p.records.map((r, idx) =>
                idx === recordIndex ? { ...r, cost: nextCost, paidAmount: nextPaidAmount, status: nextStatus } : r
              ),
            }
          : p
      )
    );
  };
  const [, setRegistrations] = useState<Registration[]>([]);
  const addRegistration = (data: { date: string; patient: { name: string; nrm: string }; poli: string; doctor: string; complaint: string }) => {
    setRegistrations((prev) => {
      const nextId = prev.length ? Math.max(...prev.map((r) => r.id)) + 1 : 1;
      const nextQueue = prev.filter((r) => r.date === data.date).length + 1;
      return [
        ...prev,
        { id: nextId, date: data.date, queue: nextQueue, patient: data.patient, poli: data.poli, doctor: data.doctor, complaint: data.complaint, status: 'antrian' },
      ];
    });
    if (supabase) {
      (async () => {
        const { data: pRow } = await supabase.from('patients').select('id,nrm').eq('nrm', data.patient.nrm).limit(1).maybeSingle();
        let patient_id = pRow?.id as string | undefined;
        if (!patient_id) {
          const { data: inserted } = await supabase
            .from('patients')
            .insert({ nrm: data.patient.nrm, name: data.patient.name })
            .select('id')
            .single();
          patient_id = inserted?.id;
        }
        const { data: poliRow } = await supabase.from('polies').select('id').eq('name', data.poli).limit(1).maybeSingle();
        const poli_id = poliRow?.id as string | undefined;
        const { data: docRow } = await supabase.from('doctors').select('id').eq('name', data.doctor).limit(1).maybeSingle();
        const doctor_id = docRow?.id as string | undefined;
        let nextQueueDb = 1;
        const headRes = await supabase
          .from('registrations')
          .select('*', { count: 'exact', head: true })
          .eq('date', data.date)
          .is('deleted_at', null);
        const cnt = (headRes as { count: number | null } | null)?.count ?? null;
        if (typeof cnt === 'number') nextQueueDb = cnt + 1;
        await supabase
          .from('registrations')
          .insert({
            date: data.date,
            queue: nextQueueDb,
            patient_id,
            poli_id,
            doctor_id,
            complaint: data.complaint,
            status: 'antrian',
          });
      })();
    }
  };
  const updateRegistration = (id: number, changes: Partial<Registration>) => {
    setRegistrations((prev) => prev.map((r) => (r.id === id ? { ...r, ...changes } : r)));
    if (supabase) {
      (async () => {
        const dbId = regDbIdMapRef.current.get(id);
        if (!dbId) return;
        const payload: Record<string, unknown> = {};
        if (changes.date) payload.date = changes.date;
        if (changes.complaint !== undefined) payload.complaint = changes.complaint;
        if (changes.status) payload.status = changes.status;
        if (changes.patient) {
          const { data: pRow } = await supabase.from('patients').select('id,nrm').eq('nrm', changes.patient.nrm).limit(1).maybeSingle();
          if (pRow?.id) payload.patient_id = pRow.id;
        }
        if (changes.poli) {
          const { data: poliRow } = await supabase.from('polies').select('id').eq('name', changes.poli).limit(1).maybeSingle();
          if (poliRow?.id) payload.poli_id = poliRow.id;
        }
        if (changes.doctor) {
          const { data: docRow } = await supabase.from('doctors').select('id').eq('name', changes.doctor).limit(1).maybeSingle();
          if (docRow?.id) payload.doctor_id = docRow.id;
        }
        if (Object.keys(payload).length > 0) {
          await supabase.from('registrations').update(payload).eq('id', dbId);
        }
      })();
    }
  };
  const deleteRegistration = (id: number) => {
    setRegistrations((prev) => prev.filter((r) => r.id !== id));
    if (supabase) {
      (async () => {
        const dbId = regDbIdMapRef.current.get(id);
        if (!dbId) return;
        await supabase.from('registrations').update({ deleted_at: new Date().toISOString() }).eq('id', dbId);
      })();
    }
  };

  const getHashPath = () => {
    const raw = window.location.hash.replace(/^#/, '');
    return raw || '/dashboard';
  };

  useEffect(() => {
    const update = () => setRoutePath(getHashPath());
    update();
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);

  const navigate = useCallback((path: string) => {
    if (!path.startsWith('/')) path = `/${path}`;
    window.location.hash = path;
  }, []);

  const currentPage: Page = useMemo(() => {
    const path = routePath || '/dashboard';
    if (path.startsWith('/users')) return 'users';
    if (path.startsWith('/patients')) return 'patients';
    if (path.startsWith('/pendaftaran')) return 'pendaftaran';
    if (path.startsWith('/pemeriksaan')) return 'pemeriksaan';
    if (path.startsWith('/billing')) return 'billing';
    if (path.startsWith('/stok-obat')) return 'stok-obat';
    if (path.startsWith('/pemasukan')) return 'pemasukan';
    if (path.startsWith('/pengeluaran')) return 'pengeluaran';
    if (path.startsWith('/laporan')) return 'laporan';
    if (path.startsWith('/master-poli')) return 'master-poli';
    if (path.startsWith('/master-dokter')) return 'master-dokter';
    if (path.startsWith('/master-obat')) return 'master-obat';
    if (path.startsWith('/master-tindakan')) return 'master-tindakan';
    if (path.startsWith('/master-diagnosa')) return 'master-diagnosa';
    if (path.startsWith('/master-administrasi')) return 'master-administrasi';
    if (path.startsWith('/master-penunjang')) return 'master-penunjang';
    if (path.startsWith('/master-supplier')) return 'master-supplier';
    if (path.startsWith('/master-kamar')) return 'master-kamar';
    return 'dashboard';
  }, [routePath]);
  useEffect(() => {
  }, [currentPage]);

  const renderPage = () => {
    const path = routePath || '/dashboard';
    const segments = path.split('/').filter(Boolean);
    if (!authUser) return <Login onLoggedIn={handleLoggedIn} />;
    if (segments.length === 0 || segments[0] === 'dashboard') return <Dashboard />;
    if (segments[0] === 'users') return <Users />;
    if (segments[0] === 'patients') {
      const nrm = segments[1];
      const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
      const stockAgg: Record<string, number> = {};
      for (const it of inventoryDb) {
        const key = norm(it.name);
        const total = (it.batches || []).reduce((sum, b) => sum + Number(b.qty ?? 0), 0);
        stockAgg[key] = (stockAgg[key] || 0) + total;
      }
      return (
        <Patients
          initialNRM={nrm}
          registrations={registrationsDb}
          patients={patientsDb}
          onClearInitialNRM={() => {
            /* no-op, handled by hash */
          }}
          stockByName={stockAgg}
          onConsumeMeds={(meds) =>
            consumeStockByMedUsages(
              meds
                .filter((m) => (m.qty ?? 0) > 0)
                .map((m) => ({ name: m.name, qty: m.qty ?? 0 }))
            )
          }
        />
      );
    }
    if (segments[0] === 'pendaftaran')
      return (
        <Pendaftaran
          registrations={registrationsDb}
          onAdd={addRegistration}
          onUpdate={updateRegistration}
          onDelete={deleteRegistration}
        />
      );
    if (segments[0] === 'pemeriksaan')
      return <PemeriksaanRajal registrations={registrationsDb} onOpenPatient={(nrm) => navigate(`/patients/${nrm}`)} />;
    if (segments[0] === 'billing') {
      const billNRM = segments[1];
      const billRecordIndex = segments[2] ? Number(segments[2]) : undefined;
      return (
        <Billing
          patients={patientsDb}
          initialNRM={billNRM}
          initialRecordIndex={billRecordIndex}
          onPay={(nrm, idx, nextCost, nextPaid) => updateRecordPayment(nrm, idx, nextCost, nextPaid)}
        />
      );
    }
    if (segments[0] === 'pemasukan') return <FinanceIncome patients={patientsDb} />;
    if (segments[0] === 'pengeluaran')
      return (
        <FinanceExpense
          onAddPurchaseItems={(items) => {
            items.forEach((i) => addStockBatch(i.itemId, { id: i.batchId || `AUTO-${Date.now()}`, qty: i.qty, expires: i.expires }));
          }}
        />
      );
    if (segments[0] === 'stok-obat')
      return (
        <Stock
          items={inventoryDb}
          onAddBatch={addStockBatch}
          onReduceByItemId={reduceStockByItemId}
          getDrugUuidByItemId={(id) => numUuidRef.current.get(id)}
          readOnly={inventoryDb.length > 0}
        />
      );
    if (segments[0] === 'laporan') return <Reports />;
    if (segments[0] === 'master-poli') return <MasterPoli />;
    if (segments[0] === 'master-dokter') return <MasterDokter />;
    if (segments[0] === 'master-obat') return <MasterObat />;
    if (segments[0] === 'master-adjust-obat') return <MasterAdjustObat />;
    if (segments[0] === 'master-tindakan') return <MasterTindakan />;
    if (segments[0] === 'master-diagnosa') return <MasterDiagnosa />;
    if (segments[0] === 'master-administrasi') return <MasterAdministrasi />;
    if (segments[0] === 'master-penunjang') return <MasterPenunjang />;
    if (segments[0] === 'master-supplier') return <MasterSupplier />;
    if (segments[0] === 'master-kamar') return <MasterKamar />;
    return <Dashboard />;
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {authUser && (
        <Sidebar
          currentPage={currentPage}
          onPageChange={(page) => {
            const map: Record<Page, string> = {
              dashboard: '/dashboard',
              users: '/users',
              patients: '/patients',
              pendaftaran: '/pendaftaran',
              pemeriksaan: '/pemeriksaan',
              billing: '/billing',
              'stok-obat': '/stok-obat',
              pemasukan: '/pemasukan',
              pengeluaran: '/pengeluaran',
              laporan: '/laporan',
              'master-poli': '/master-poli',
              'master-dokter': '/master-dokter',
              'master-obat': '/master-obat',
              'master-adjust-obat': '/master-adjust-obat',
              'master-tindakan': '/master-tindakan',
              'master-diagnosa': '/master-diagnosa',
              'master-administrasi': '/master-administrasi',
              'master-penunjang': '/master-penunjang',
              'master-supplier': '/master-supplier',
              'master-kamar': '/master-kamar',
              login: '/login',
            };
            navigate(map[page]);
          }}
          userEmail={authUser?.email}
          onLogout={handleLogout}
        />
      )}
      <main className="flex-1 overflow-y-auto">
        {renderPage()}
      </main>
    </div>
  );
}

export default App;
