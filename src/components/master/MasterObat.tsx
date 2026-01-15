import { Plus, Pill, Edit2, CheckCircle2, XCircle, Eye, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';

export default function MasterObat() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [editId, setEditId] = useState<string | number | null>(null);
  const [rows, setRows] = useState<{ id: string | number; name: string; kandungan?: string; unit?: string; price?: number; supplier?: string; active?: boolean; dose?: string; dose_unit?: string; type?: string; indication?: string }[]>([]);
  const [detail, setDetail] = useState<{ id: string | number; name: string; kandungan?: string; unit?: string; price?: number; active?: boolean; dose?: string; dose_unit?: string; type?: string; indication?: string } | null>(null);
  const [filterQuery, setFilterQuery] = useState<string>('');
  const [addName, setAddName] = useState<string>('');
  const [addKandungan, setAddKandungan] = useState<string>('');
  const [addUnit, setAddUnit] = useState<string>('Tablet');
  const [addPrice, setAddPrice] = useState<number>(0);
  const [addPriceStr, setAddPriceStr] = useState<string>('0');
  const [addDose, setAddDose] = useState<string>('');
  const [addDoseUnit, setAddDoseUnit] = useState<string>('mg');
  const [addType, setAddType] = useState<string>('');
  const [addIndication, setAddIndication] = useState<string>('');
  const [editName, setEditName] = useState<string>('');
  const [editKandungan, setEditKandungan] = useState<string>('');
  const [editUnit, setEditUnit] = useState<string>('Tablet');
  const [editPrice, setEditPrice] = useState<number>(0);
  const [editPriceStr, setEditPriceStr] = useState<string>('0');
  const [editDose, setEditDose] = useState<string>('');
  const [editDoseUnit, setEditDoseUnit] = useState<string>('mg');
  const [editType, setEditType] = useState<string>('');
  const [editIndication, setEditIndication] = useState<string>('');
  useEffect(() => {
    let active = true;
    try {
      const cache = localStorage.getItem('drugs_cache');
      if (cache) {
        const arr = JSON.parse(cache);
        if (Array.isArray(arr)) {
          setRows(arr);
        }
      }
    } catch (e) { void e; }
    const fetchDrugs = async () => {
      if (!supabase) return;
      const { data: drugs } = await supabase.from('drugs').select('id,name,kandungan,unit,price,active,dose,dose_unit,type,indication').order('name', { ascending: true });
      if (!drugs || !active) return;
      const mapped = (drugs as { id: string; name: string; kandungan?: string | null; unit?: string | null; price?: number | null; active?: boolean | null; dose?: string | null; dose_unit?: string | null; type?: string | null; indication?: string | null }[]).map((d) => ({
        id: d.id,
        name: d.name,
        kandungan: d.kandungan || undefined,
        unit: d.unit || undefined,
        price: d.price ?? 0,
        active: d.active ?? true,
        dose: d.dose || undefined,
        dose_unit: d.dose_unit || undefined,
        supplier: undefined,
        type: d.type || undefined,
        indication: d.indication || undefined,
      }));
      setRows(mapped);
      try { localStorage.setItem('drugs_cache', JSON.stringify(mapped)); } catch (e) { void e; }
    };
    fetchDrugs();
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!supabase) return;
    const ch = supabase
      .channel('realtime-drugs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drugs' }, async () => {
        if (!supabase) return;
        const { data: drugs } = await supabase.from('drugs').select('id,name,kandungan,unit,price,active,dose,dose_unit,type,indication').order('name', { ascending: true });
        if (!drugs) return;
        const mapped = (drugs as { id: string; name: string; kandungan?: string | null; unit?: string | null; price?: number | null; active?: boolean | null; dose?: string | null; dose_unit?: string | null; type?: string | null; indication?: string | null }[]).map((d) => ({
          id: d.id,
          name: d.name,
          kandungan: d.kandungan || undefined,
          unit: d.unit || undefined,
          price: d.price ?? 0,
          active: d.active ?? true,
          dose: d.dose || undefined,
          dose_unit: d.dose_unit || undefined,
          supplier: undefined,
          type: d.type || undefined,
          indication: d.indication || undefined,
        }));
        setRows(mapped);
        try { localStorage.setItem('drugs_cache', JSON.stringify(mapped)); } catch (e) { void e; }
      })
      .subscribe();
    return () => {
      if (supabase) supabase.removeChannel(ch);
    };
  }, []);

  const filteredRows = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const name = r.name.toLowerCase();
      const kand = (r.kandungan || '').toLowerCase();
      const typ = (r.type || '').toLowerCase();
      return name.includes(q) || kand.includes(q) || typ.includes(q);
    });
  }, [rows, filterQuery]);

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Master Obat</h1>
          <p className="text-gray-600 mt-1">Kelola data obat klinik</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder="Cari nama/kandungan/jenis"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="w-64 pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-lg hover:bg-emerald-700 transition-colors shadow-lg"
          >
            <Plus className="w-5 h-5" />
            <span className="font-medium">Tambah Obat</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Nama Obat (Merk)</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Kandungan</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Jenis Obat</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Satuan</th>
                <th className="text-right py-4 px-6 text-sm font-semibold text-gray-700">Harga Jual</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Status</th>
                <th className="text-right py-4 px-6 text-sm font-semibold text-gray-700">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredRows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-4 px-6 text-sm font-medium text-gray-800 flex items-center gap-2">
                    <span className="w-8 h-8 bg-emerald-100 rounded-lg inline-flex items-center justify-center">
                      <Pill className="w-4 h-4 text-emerald-600" />
                    </span>
                    {row.name}
                  </td>
                  <td className="py-4 px-6 text-sm text-gray-600">{row.kandungan || '-'}</td>
                  <td className="py-4 px-6 text-sm text-gray-600">{row.type || '-'}</td>
                  <td className="py-4 px-6 text-sm text-gray-600">
                    <div className="flex flex-col">
                      <span className="text-gray-800">{(row.dose && row.dose_unit) ? `${row.dose} ${row.dose_unit}` : '-'}</span>
                      <span className="text-gray-600">{row.unit}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-right text-sm font-semibold text-gray-800">
                    Rp {(row.price ?? 0).toLocaleString('id-ID')}
                  </td>
                  <td className="py-4 px-6 text-sm">
                    {row.active ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700">
                        <CheckCircle2 className="w-4 h-4" /> Aktif
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-gray-500">
                        <XCircle className="w-4 h-4" /> Tidak aktif
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setDetail(row);
                          setShowDetailModal(true);
                        }}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Detail"
                      >
                        <Eye className="w-4 h-4 text-gray-600" />
                      </button>
                      <button
                        onClick={() => {
                          setEditId(row.id);
                      setEditName(row.name || '');
                      setEditKandungan(row.kandungan || '');
                      setEditUnit(row.unit || 'Tablet');
                      setEditPrice(row.price ?? 0);
                      setEditPriceStr(new Intl.NumberFormat('id-ID').format(row.price ?? 0));
                      setEditDose(row.dose || '');
                      setEditDoseUnit(row.dose_unit || 'mg');
                      setEditType(row.type || '');
                      setEditIndication(row.indication || '');
                      setShowEditModal(true);
                    }}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <Edit2 className="w-4 h-4 text-gray-600" />
                  </button>
                      <button
                        onClick={async () => {
                          if (!supabase) return;
                          const next = !row.active;
                          await supabase.from('drugs').update({ active: next }).eq('id', row.id);
                          setRows((prev) => {
                            const nextRows = prev.map((r) => (r.id === row.id ? { ...r, active: next } : r));
                            try { localStorage.setItem('drugs_cache', JSON.stringify(nextRows)); } catch (e) { void e; }
                            return nextRows;
                          });
                        }}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        title={row.active ? 'Nonaktifkan' : 'Aktifkan'}
                      >
                        {row.active ? <XCircle className="w-4 h-4 text-gray-600" /> : <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-800">Tambah Obat</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nama obat / merk</label>
                <input
                  type="text"
                  placeholder="Contoh: Alpara, Paratusin"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Kandungan</label>
                <input
                  type="text"
                  placeholder="Contoh: Paracetamol, HCl"
                  value={addKandungan}
                  onChange={(e) => setAddKandungan(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Jenis Obat</label>
                <input
                  type="text"
                  placeholder="Contoh: Paracetamol, Flu"
                  value={addType}
                  onChange={(e) => setAddType(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Kegunaan</label>
                <textarea
                  placeholder="Deskripsi kegunaan obat (bebas): demam, nyeri, flu, dll"
                  value={addIndication}
                  onChange={(e) => setAddIndication(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Satuan</label>
                  <select
                    value={addUnit}
                    onChange={(e) => setAddUnit(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  >
                    <option>Tablet</option>
                    <option>Kapsul</option>
                    <option>Sirup</option>
                    <option>Salep</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Dosis</label>
                  <input
                    type="text"
                    placeholder="contoh: 500"
                    value={addDose}
                    onChange={(e) => setAddDose(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Satuan Dosis</label>
                  <select
                    value={addDoseUnit}
                    onChange={(e) => setAddDoseUnit(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  >
                    <option>mg</option>
                    <option>ml</option>
                    <option>g</option>
                    <option>mcg</option>
                    <option>IU</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Harga Jual</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">Rp</span>
                  <input
                    type="text"
                    placeholder="0"
                    value={addPriceStr}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^\d]/g, '');
                      const num = Number(raw || '0');
                      setAddPrice(num);
                      setAddPriceStr(new Intl.NumberFormat('id-ID').format(num));
                    }}
                    className="w-full pl-12 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button onClick={() => setShowAddModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-gray-700">Batal</button>
              <button
                onClick={async () => {
                  const name = addName.trim();
                  if (!name) return;
                  if (!supabase) return;
                  const { data: inserted } = await supabase.from('drugs').insert({
                    name,
                    kandungan: addKandungan ? addKandungan : null,
                    unit: addUnit,
                    price: addPrice,
                    supplier_id: null,
                    dose: addDose ? addDose : null,
                    dose_unit: addDoseUnit ? addDoseUnit : null,
                    type: addType || null,
                    indication: addIndication || null,
                    active: true,
                  }).select('id,name,kandungan,unit,price,active,dose,dose_unit,type,indication').single();
                  if (inserted) {
                    setRows((prev) => [
                      ...prev,
                      {
                        id: inserted.id,
                        name: inserted.name,
                        kandungan: inserted.kandungan || undefined,
                        unit: inserted.unit || undefined,
                        price: inserted.price ?? 0,
                        active: inserted.active ?? true,
                        dose: inserted.dose || undefined,
                        dose_unit: inserted.dose_unit || undefined,
                        supplier: undefined,
                        type: inserted.type || undefined,
                        indication: inserted.indication || undefined,
                      },
                    ]);
                  }
                  setShowAddModal(false);
                  setAddName('');
                  setAddKandungan('');
                  setAddUnit('Tablet');
                  setAddPrice(0);
                  setAddPriceStr('0');
                  setAddDose('');
                  setAddDoseUnit('mg');
                  setAddType('');
                  setAddIndication('');
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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-800">Edit Obat</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nama obat / merk</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Kandungan</label>
                <input
                  type="text"
                  value={editKandungan}
                  onChange={(e) => setEditKandungan(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Jenis Obat</label>
                <input
                  type="text"
                  value={editType}
                  onChange={(e) => setEditType(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Kegunaan</label>
                <textarea
                  value={editIndication}
                  onChange={(e) => setEditIndication(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Satuan</label>
                  <select
                    value={editUnit}
                    onChange={(e) => setEditUnit(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  >
                    <option>Tablet</option>
                    <option>Kapsul</option>
                    <option>Sirup</option>
                    <option>Salep</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Dosis</label>
                  <input
                    type="text"
                    value={editDose}
                    onChange={(e) => setEditDose(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Satuan Dosis</label>
                  <select
                    value={editDoseUnit}
                    onChange={(e) => setEditDoseUnit(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  >
                    <option>mg</option>
                    <option>ml</option>
                    <option>g</option>
                    <option>mcg</option>
                    <option>IU</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Harga Jual</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">Rp</span>
                  <input
                    type="text"
                    value={editPriceStr}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^\d]/g, '');
                      const num = Number(raw || '0');
                      setEditPrice(num);
                      setEditPriceStr(new Intl.NumberFormat('id-ID').format(num));
                    }}
                    className="w-full pl-12 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditId(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-gray-700"
              >
                Batal
              </button>
              <button
                onClick={async () => {
                  const name = editName.trim();
                  if (!name || editId === null) return;
                  if (!supabase) return;
                  await supabase
                    .from('drugs')
                    .update({
                      name,
                      kandungan: editKandungan ? editKandungan : null,
                      unit: editUnit,
                      price: editPrice,
                      supplier_id: null,
                      dose: editDose ? editDose : null,
                      dose_unit: editDoseUnit ? editDoseUnit : null,
                      type: editType || null,
                      indication: editIndication || null,
                    })
                    .eq('id', editId);
                  setRows((prev) => {
                    const nextRows = prev.map((r) =>
                      r.id === editId
                        ? {
                            ...r,
                            name,
                            kandungan: editKandungan || undefined,
                            unit: editUnit,
                            price: editPrice,
                            dose: editDose || undefined,
                            dose_unit: editDoseUnit || undefined,
                            type: editType || undefined,
                            indication: editIndication || undefined,
                          }
                        : r
                    );
                    try { localStorage.setItem('drugs_cache', JSON.stringify(nextRows)); } catch (e) { void e; }
                    return nextRows;
                  });
                  setShowEditModal(false);
                  setEditId(null);
                }}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
      {showDetailModal && detail !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-800">Detail Obat</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <div className="text-sm text-gray-600 mb-1">Nama obat / merk</div>
                <div className="text-gray-800 font-medium">{detail.name}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">Kandungan</div>
                <div className="text-gray-800 font-medium">{detail.kandungan || '-'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">Jenis Obat</div>
                <div className="text-gray-800 font-medium">{detail.type || '-'}</div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-600 mb-1">Dosis</div>
                  <div className="text-gray-800 font-medium">{detail.dose ? `${detail.dose} ${detail.dose_unit || ''}` : '-'}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 mb-1">Satuan</div>
                  <div className="text-gray-800 font-medium">{detail.unit || '-'}</div>
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">Harga Jual</div>
                <div className="text-gray-800 font-semibold">Rp {(detail.price ?? 0).toLocaleString('id-ID')}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">Status</div>
                <div className="text-gray-800 font-medium">{detail.active ? 'Aktif' : 'Tidak aktif'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">Kegunaan</div>
                <div className="text-gray-800">{detail.indication || '-'}</div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setDetail(null);
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-gray-700"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
