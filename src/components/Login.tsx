import { useState } from 'react';
import { Lock, Mail, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface LoginProps {
  onLoggedIn: (user: { id: string; email: string; full_name?: string; role?: string }) => void;
}

export default function Login({ onLoggedIn }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPwd, setShowPwd] = useState(false);

  const doLogin = async () => {
    setError(null);
    if (!email.trim() || !password.trim()) {
      setError('Email dan password wajib diisi');
      return;
    }
    setLoading(true);
    try {
      if (!supabase) {
        setError('Koneksi database tidak tersedia');
        return;
      }
      const { data } = await supabase.rpc('login_user', { p_email: email.trim(), p_password: password });
      const rows = (data || []) as { id: string; email: string; full_name?: string; role?: string }[];
      if (rows.length === 0) {
        setError('Email atau password salah');
        return;
      }
      const u = rows[0];
      onLoggedIn({ id: u.id, email: u.email, full_name: u.full_name, role: u.role });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-gray-100 p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
            <Lock className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Masuk</h1>
            <p className="text-gray-600">Login ke aplikasi klinik</p>
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="masukan email"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="masukan password"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPwd((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPwd ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
          <button
            onClick={doLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Lock className="w-5 h-5" />
            <span className="font-medium">{loading ? 'Masuk...' : 'Masuk'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
