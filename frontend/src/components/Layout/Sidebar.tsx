import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

const navItems: NavItem[] = [
  { path: '/dashboard', label: 'Dashboard', icon: 'grid_view' },
  { path: '/bots', label: 'Bots', icon: 'smart_toy' },
  { path: '/documents', label: 'Documents', icon: 'folder' },
  { path: '/analytics', label: 'Analytics', icon: 'leaderboard' },
  { path: '/integrations', label: 'Integrations', icon: 'hub' },
  { path: '/data-grid', label: 'Data Grid', icon: 'table_chart' },
  { path: '/settings', label: 'Settings', icon: 'settings' },
];

export default function Sidebar() {
  const location = useLocation();
  const { user, logout } = useAuthStore();

  const isActive = (path: string) => location.pathname === path;

  return (
    <aside className="w-[240px] flex-shrink-0 bg-gradient-to-b from-ray-surface/80 to-ray-surface/40 backdrop-blur-xl border-r border-white/5 flex flex-col h-full animate-ray-fade-in relative z-20">
      {/* Search / App Selection Area */}
      <div className="h-14 flex items-center px-4 gap-3 border-b border-white/5 mb-2">
        <div className="size-8 rounded-lg overflow-hidden border border-white/10 shadow-[0_0_15px_rgba(88,166,255,0.2)]">
          <img src="/logo.png" alt="OmniRAG Logo" className="w-full h-full object-cover" />
        </div>
        <span className="text-sm font-bold tracking-tight text-ray-text">OmniRAG</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-2 flex flex-col gap-0.5">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex items-center gap-3 px-3 py-2 rounded-ray-button text-sm transition-colors group ${isActive(item.path)
              ? 'bg-white/10 text-ray-text'
              : 'text-ray-muted hover:bg-white/5 hover:text-ray-text'
              }`}
          >
            <span
              className={`material-symbols-outlined text-[20px] transition-transform duration-200 ${isActive(item.path) ? 'fill' : 'group-hover:scale-110'
                }`}
            >
              {item.icon}
            </span>
            <span className="font-medium">{item.label}</span>
            {isActive(item.path) && (
              <div className="ml-auto size-1.5 rounded-full bg-ray-primary shadow-[0_0_8px_rgba(255,99,99,0.5)]" />
            )}
          </Link>
        ))}
      </nav>

      {/* User & Footer */}
      <div className="mt-auto p-4 border-t border-ray-border">
        <div className="flex items-center gap-3 group">
          <div className="size-8 rounded-full bg-ray-surface-elevated border border-ray-border-bright flex items-center justify-center text-[12px] font-bold text-ray-muted group-hover:text-ray-text transition-colors">
            {user?.full_name?.charAt(0) || 'U'}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-semibold text-ray-text truncate">
              {user?.full_name || 'User'}
            </span>
            <span className="text-[10px] text-ray-muted truncate">
              {user?.email || 'user@example.com'}
            </span>
          </div>
          <button
            onClick={logout}
            className="ml-auto p-1.5 text-ray-muted hover:text-ray-primary hover:bg-white/5 rounded-md transition-all opacity-0 group-hover:opacity-100"
            title="Logout"
          >
            <span className="material-symbols-outlined text-[18px]">logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
