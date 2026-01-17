import { useState } from 'react';
import {
  LayoutDashboard,
  Wallet,
  FileText,
  Bookmark,
  Users,
  Stethoscope,
  ClipboardList,
  Pill,
  Activity,
  Cog,
  Truck,
  Menu,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';

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
  | 'master-kamar';

interface SidebarProps {
  currentPage: Page;
  onPageChange: (page: Page) => void;
  userEmail?: string;
  onLogout?: () => void;
}

export default function Sidebar({ currentPage, onPageChange, userEmail, onLogout }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const masterItems: { id: Page; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'users', label: 'User', icon: Users },
    { id: 'master-poli', label: 'Poli', icon: ClipboardList },
    { id: 'master-dokter', label: 'Dokter', icon: Stethoscope },
    { id: 'master-obat', label: 'Obat', icon: Pill },
    { id: 'master-adjust-obat', label: 'Adjust Obat', icon: Activity },
    { id: 'master-tindakan', label: 'Tindakan', icon: Activity },
    { id: 'master-diagnosa', label: 'Diagnosa', icon: FileText },
    { id: 'master-administrasi', label: 'Administrasi', icon: Cog },
    { id: 'master-penunjang', label: 'Penunjang', icon: ClipboardList },
    { id: 'master-supplier', label: 'Supplier', icon: Truck },
  ];

  const menuItems = [
    { id: 'dashboard' as Page, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'patients' as Page, label: 'Pasien', icon: Users },
    { id: 'billing' as Page, label: 'Billing', icon: Wallet },
    { id: 'stok-obat' as Page, label: 'Stok Obat', icon: Pill },
    { id: 'pemasukan' as Page, label: 'Pemasukan', icon: Wallet },
    { id: 'pengeluaran' as Page, label: 'Pengeluaran', icon: FileText },
    { id: 'laporan' as Page, label: 'Laporan', icon: FileText },
  ] as const;

  const isMasterActive = masterItems.some((m) => m.id === currentPage);
  const handleNavigate = (page: Page) => {
    onPageChange(page);
    setMobileOpen(false);
  };

  return (
    <>
      <button
        type="button"
        className="md:hidden fixed top-4 left-4 z-50 p-3 rounded-full bg-blue-600 text-white shadow-lg"
        onClick={() => setMobileOpen(true)}
      >
        <Menu className="w-5 h-5" />
      </button>
      <aside
        className={`${collapsed ? 'w-20' : 'w-64'} bg-gradient-to-b from-blue-900 to-slate-900 text-white flex-col hidden md:flex transition-all`}
      >
        <div className="p-6 border-b border-blue-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
              <Bookmark className="w-6 h-6" />
            </div>
            <div className="flex-1 flex items-center justify-between">
              {!collapsed && (
                <div>
                  <h1 className="text-xl font-bold">MyClinic</h1>
                  <p className="text-xs text-blue-200/80">MyClinic</p>
                </div>
              )}
              <button
                type="button"
                className="items-center justify-center w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 transition-colors hidden md:flex"
                onClick={() => setCollapsed((v) => !v)}
              >
                {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;

            return (
              <li key={item.id}>
                <button
                  onClick={() => onPageChange(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors backdrop-blur-sm ${
                    isActive
                      ? 'bg-white/10 text-white shadow-lg'
                      : 'text-blue-100 hover:bg-white/10'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {!collapsed && <span className="font-medium">{item.label}</span>}
                </button>
              </li>
            );
          })}
          <li>
            <details className="group" open={isMasterActive}>
              <summary
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors cursor-pointer list-none backdrop-blur-sm ${
                  isMasterActive ? 'bg-white/10 text-white shadow-lg' : 'text-blue-100 hover:bg-white/10'
                }`}
              >
                <ClipboardList className="w-5 h-5" />
                {!collapsed && <span className="font-medium flex-1">Master Data</span>}
                {!collapsed && (
                  <svg
                    className="w-4 h-4 transition-transform group-open:rotate-180"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </summary>
              <ul className="mt-2 ml-2 space-y-1">
                {masterItems.map((item) => {
                  const Icon = item.icon;
                  const active = currentPage === item.id;
                  return (
                    <li key={item.id}>
                      <button
                        onClick={() => onPageChange(item.id)}
                        className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-colors backdrop-blur-sm ${
                          active ? 'bg-white/10 text-white' : 'text-blue-100 hover:bg-white/10'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {!collapsed && <span className="text-sm">{item.label}</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </details>
          </li>
        </ul>
      </nav>

      <div className="p-4 border-t border-blue-800/50">
        <div className="px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center">
              <span className="text-sm font-semibold">{(userEmail || 'A').slice(0, 1).toUpperCase()}</span>
            </div>
            {!collapsed && (
              <div className="flex-1">
                <p className="text-sm font-medium">{userEmail || 'Administrator'}</p>
                <p className="text-xs text-blue-200/80">Klinik</p>
              </div>
            )}
          </div>
          {onLogout && !collapsed && (
            <button
              onClick={onLogout}
              className="mt-3 w-full px-4 py-2 text-sm rounded-lg bg-white/10 text-blue-100 hover:bg-white/20 transition-colors"
            >
              Keluar
            </button>
          )}
        </div>
      </div>
      </aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-64 bg-gradient-to-b from-blue-900 to-slate-900 text-white flex flex-col shadow-xl">
            <div className="p-4 flex items-center justify-between border-b border-blue-800/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
                  <Bookmark className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">MyClinic</h1>
                  <p className="text-xs text-blue-200/80">MyClinic</p>
                </div>
              </div>
              <button
                type="button"
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center"
                onClick={() => setMobileOpen(false)}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <nav className="p-4">
                <ul className="space-y-2">
                  {menuItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentPage === item.id;
                    return (
                      <li key={item.id}>
                        <button
                          onClick={() => handleNavigate(item.id)}
                          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors backdrop-blur-sm ${
                            isActive ? 'bg-white/10 text-white shadow-lg' : 'text-blue-100 hover:bg-white/10'
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                          <span className="font-medium">{item.label}</span>
                        </button>
                      </li>
                    );
                  })}
                  <li>
                    <details className="group" open={isMasterActive}>
                      <summary
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors cursor-pointer list-none backdrop-blur-sm ${
                          isMasterActive ? 'bg-white/10 text-white shadow-lg' : 'text-blue-100 hover:bg-white/10'
                        }`}
                      >
                        <ClipboardList className="w-5 h-5" />
                        <span className="font-medium flex-1">Master Data</span>
                        <svg
                          className="w-4 h-4 transition-transform group-open:rotate-180"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </summary>
                      <ul className="mt-2 ml-2 space-y-1">
                        {masterItems.map((item) => {
                          const Icon = item.icon;
                          const active = currentPage === item.id;
                          return (
                            <li key={item.id}>
                              <button
                                onClick={() => handleNavigate(item.id)}
                                className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-colors backdrop-blur-sm ${
                                  active ? 'bg-white/10 text-white' : 'text-blue-100 hover:bg-white/10'
                                }`}
                              >
                                <Icon className="w-4 h-4" />
                                <span className="text-sm">{item.label}</span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </details>
                  </li>
                </ul>
              </nav>
            </div>
            <div className="p-4 border-t border-blue-800/50">
              <div className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center">
                    <span className="text-sm font-semibold">{(userEmail || 'A').slice(0, 1).toUpperCase()}</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{userEmail || 'Administrator'}</p>
                    <p className="text-xs text-blue-200/80">Klinik</p>
                  </div>
                </div>
                {onLogout && (
                  <button
                    onClick={onLogout}
                    className="mt-3 w-full px-4 py-2 text-sm rounded-lg bg-white/10 text-blue-100 hover:bg-white/20 transition-colors"
                  >
                    Keluar
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
