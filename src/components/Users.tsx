import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, Users as UsersIcon, Edit2, Lock, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

type UserRow = {
  id: string;
  username: string;
  full_name: string;
  email?: string;
  phone?: string;
  role: string;
  active: boolean;
  last_login?: string;
};

export default function Users() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [addUsername, setAddUsername] = useState('');
  const [addFullName, setAddFullName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [addRole, setAddRole] = useState('admin');
  const [addPassword, setAddPassword] = useState('');

  const [editId, setEditId] = useState<string | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editFullName, setEditFullName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRole, setEditRole] = useState('admin');

  const [pwdId, setPwdId] = useState<string | null>(null);
  const [pwdValue, setPwdValue] = useState('');
  const pwdInputRef = useRef<HTMLInputElement | null>(null);

  const [toggleActiveId, setToggleActiveId] = useState<string | null>(null);
  const [toggleActiveNext, setToggleActiveNext] = useState<boolean>(false);

  const fetchUsers = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('users')
      .select('id,username,full_name,email,phone,role,active,last_login')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    setRows(
      ((data || []) as {
        id: string;
        username: string;
        full_name: string;
        email?: string | null;
        phone?: string | null;
        role?: string | null;
        active?: boolean | null;
        last_login?: string | null;
      }[]).map((u) => ({
        id: u.id,
        username: u.username,
        full_name: u.full_name,
        email: u.email || '',
        phone: u.phone || '',
        role: u.role || 'admin',
        active: !!u.active,
        last_login: u.last_login || '',
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const doAdd = async () => {
    if (!supabase) return;
    if (!addUsername.trim() || !addFullName.trim() || !addPassword.trim()) {
      setError('Username, Nama Lengkap, dan Password wajib diisi');
      return;
    }
    setError(null);
    const { error } = await supabase.rpc('create_user', {
      p_username: addUsername.trim(),
      p_full_name: addFullName.trim(),
      p_email: addEmail.trim() || null,
      p_phone: addPhone.trim() || null,
      p_role: addRole.trim(),
      p_password: addPassword,
    });
    if (error) {
      setError(error.message);
      return;
    }
    setShowAdd(false);
    setAddUsername('');
    setAddFullName('');
    setAddEmail('');
    setAddPhone('');
    setAddRole('admin');
    setAddPassword('');
    await fetchUsers();
  };

  const openEdit = (u: UserRow) => {
    setEditId(u.id);
    setEditUsername(u.username);
    setEditFullName(u.full_name);
    setEditEmail(u.email || '');
    setEditPhone(u.phone || '');
    setEditRole(u.role);
  };
  const doEdit = async () => {
    if (!supabase || !editId) return;
    setError(null);
    const { error } = await supabase.rpc('update_user', {
      p_id: editId,
      p_username: editUsername.trim() || null,
      p_full_name: editFullName.trim() || null,
      p_email: editEmail.trim() || null,
      p_phone: editPhone.trim() || null,
      p_role: editRole.trim() || null,
    });
    if (error) {
      setError(error.message);
      return;
    }
    setEditId(null);
    await fetchUsers();
  };

  const openPwd = (u: UserRow) => {
    setPwdId(u.id);
    setPwdValue('');
  };
  const doPwd = async () => {
    if (!supabase || !pwdId) return;
    if (!pwdValue.trim()) {
      setError('Password baru wajib diisi');
      return;
    }
    setError(null);
    const { error } = await supabase.rpc('set_user_password', { p_id: pwdId, p_password: pwdValue });
    if (error) {
      setError(error.message);
      return;
    }
    setPwdId(null);
    await fetchUsers();
  };

  const openToggleActive = (u: UserRow) => {
    setToggleActiveId(u.id);
    setToggleActiveNext(!u.active);
  };
  const doToggleActive = async () => {
    if (!supabase || !toggleActiveId) return;
    setError(null);
    const { error } = await supabase.rpc('set_user_active', { p_id: toggleActiveId, p_active: toggleActiveNext });
    if (error) {
      setError(error.message);
      return;
    }
    setToggleActiveId(null);
    await fetchUsers();
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
            <UsersIcon className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">User</h1>
            <p className="text-gray-600">Kelola akun pengguna aplikasi</p>
          </div>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Tambah User
        </button>
      </div>

      {error && <div className="text-sm text-red-600 mb-4">{error}</div>}
      {loading && <div className="text-sm text-gray-600 mb-4">Memuat data...</div>}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-6 py-3 text-sm font-semibold text-gray-700">Username</th>
              <th className="text-left px-6 py-3 text-sm font-semibold text-gray-700">Nama</th>
              <th className="text-left px-6 py-3 text-sm font-semibold text-gray-700">Email</th>
              <th className="text-left px-6 py-3 text-sm font-semibold text-gray-700">Role</th>
              <th className="text-left px-6 py-3 text-sm font-semibold text-gray-700">Aktif</th>
              <th className="text-right px-6 py-3 text-sm font-semibold text-gray-700">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className="border-t border-gray-100">
                <td className="px-6 py-3 text-sm text-gray-800">{u.username}</td>
                <td className="px-6 py-3 text-sm text-gray-800">{u.full_name}</td>
                <td className="px-6 py-3 text-sm text-gray-800">{u.email}</td>
                <td className="px-6 py-3 text-sm text-gray-800">{u.role}</td>
                <td className="px-6 py-3 text-sm text-gray-800">
                  {u.active ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-green-50 text-green-700">
                      <CheckCircle2 className="w-4 h-4" /> Aktif
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-gray-100 text-gray-700">
                      <XCircle className="w-4 h-4" /> Nonaktif
                    </span>
                  )}
                </td>
                <td className="px-6 py-3 text-right">
                  <div className="inline-flex gap-2">
                    <button
                      onClick={() => openEdit(u)}
                      className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 inline-flex items-center gap-2"
                    >
                      <Edit2 className="w-4 h-4" /> Edit
                    </button>
                    <button
                      onClick={() => openPwd(u)}
                      className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 inline-flex items-center gap-2"
                    >
                      <Lock className="w-4 h-4" /> Ubah Password
                    </button>
                    <button
                      onClick={() => openToggleActive(u)}
                      className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 hover:bg-gray-50"
                    >
                      {u.active ? 'Nonaktifkan' : 'Aktifkan'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-6 text-center text-sm text-gray-500">
                  Tidak ada data
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold">Tambah User</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium">Username</label>
                <input
                  value={addUsername}
                  onChange={(e) => setAddUsername(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Nama Lengkap</label>
                <input
                  value={addFullName}
                  onChange={(e) => setAddFullName(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Email</label>
                  <input value={addEmail} onChange={(e) => setAddEmail(e.target.value)} className="mt-1 w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="text-sm font-medium">Phone</label>
                  <input value={addPhone} onChange={(e) => setAddPhone(e.target.value)} className="mt-1 w-full px-3 py-2 border rounded-lg" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Role</label>
                  <select value={addRole} onChange={(e) => setAddRole(e.target.value)} className="mt-1 w-full px-3 py-2 border rounded-lg">
                    <option value="admin">admin</option>
                    <option value="staff">staff</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Password</label>
                  <input
                    type="password"
                    value={addPassword}
                    onChange={(e) => setAddPassword(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button onClick={() => setShowAdd(false)} className="flex-1 px-4 py-2 border rounded-lg">
                Batal
              </button>
              <button onClick={doAdd} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg">
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {editId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold">Edit User</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium">Username</label>
                <input value={editUsername} onChange={(e) => setEditUsername(e.target.value)} className="mt-1 w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="text-sm font-medium">Nama Lengkap</label>
                <input value={editFullName} onChange={(e) => setEditFullName(e.target.value)} className="mt-1 w-full px-3 py-2 border rounded-lg" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Email</label>
                  <input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="mt-1 w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="text-sm font-medium">Phone</label>
                  <input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="mt-1 w-full px-3 py-2 border rounded-lg" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Role</label>
                <select value={editRole} onChange={(e) => setEditRole(e.target.value)} className="mt-1 w-full px-3 py-2 border rounded-lg">
                  <option value="admin">admin</option>
                  <option value="staff">staff</option>
                </select>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button onClick={() => setEditId(null)} className="flex-1 px-4 py-2 border rounded-lg">
                Batal
              </button>
              <button onClick={doEdit} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg">
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {pwdId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold">Ubah Password</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium">Password Baru</label>
                <input
                  type="password"
                  value={pwdValue}
                  onChange={(e) => setPwdValue(e.target.value)}
                  ref={(el) => {
                    pwdInputRef.current = el;
                    if (el) setTimeout(() => el.focus(), 0);
                  }}
                  className="mt-1 w-full px-3 py-2 border rounded-lg"
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button onClick={() => setPwdId(null)} className="flex-1 px-4 py-2 border rounded-lg">
                Batal
              </button>
              <button onClick={doPwd} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg">
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {toggleActiveId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold">Ubah Status Aktif</h2>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-700">
                Apakah Anda yakin ingin {toggleActiveNext ? 'mengaktifkan' : 'menonaktifkan'} user ini?
              </p>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button onClick={() => setToggleActiveId(null)} className="flex-1 px-4 py-2 border rounded-lg">
                Batal
              </button>
              <button onClick={doToggleActive} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg">
                Ya
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
