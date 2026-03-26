import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { LayoutGrid, BotMessageSquare, Settings, LogOut } from 'lucide-react';
import { LogoIcon } from '../ui/LogoIcon';

interface NavItem {
  path: string;
  label: string;
  icon: any;
}

const navItems: NavItem[] = [
  { path: '/dashboard', label: 'Home', icon: LayoutGrid },
  { path: '/bots', label: 'AI Agents', icon: BotMessageSquare },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  const location = useLocation();
  const { user, logout } = useAuthStore();

  const isActive = (path: string) =>
    path === '/dashboard'
      ? location.pathname === '/dashboard'
      : location.pathname.startsWith(path);

  return (
    <aside className="w-64 flex-shrink-0 flex flex-col h-full relative z-20
      bg-[#07070e]/60 backdrop-blur-2xl
      border-r border-white/[0.06]
      shadow-[1px_0_0_0_rgba(255,255,255,0.04),4px_0_32px_rgba(4,4,20,0.6)]
    ">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-5 gap-3 border-b border-white/[0.06]">
        <Link
          to="/"
          title="Back to Landing Page"
          className="flex items-center gap-3 group/logo flex-1 min-w-0"
        >
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center
            shadow-[0_0_12px_rgba(79,142,240,0.15)] group-hover/logo:shadow-[0_0_20px_rgba(79,142,240,0.28)]
            transition-all duration-300">
            <LogoIcon className="w-4.5 h-4.5" />
          </div>
          <span className="text-sm font-semibold text-white/90 tracking-tight group-hover/logo:text-white transition-colors">
            OmniRAG
          </span>
          <span className="ml-auto text-[9px] font-medium tracking-wide text-white/20 border border-white/10 rounded px-1.5 py-0.5">
            v2
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-5 flex flex-col gap-0.5">
        <div className="px-3 mb-3 text-[10px] font-semibold text-white/20 tracking-[0.12em] uppercase">
          Platform
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 group
                ${active
                  ? 'text-[#7eb3f5] bg-primary/8 border border-primary/15 font-medium'
                  : 'text-white/40 hover:text-white/80 hover:bg-white/5 border border-transparent font-normal'
                }
              `}
            >
              <Icon className={`w-4 h-4 flex-shrink-0 transition-all duration-200 ${active ? 'text-primary/90' : 'group-hover:text-white/70'}`} />
              <span>{item.label}</span>
              {active && (
                <span className="ml-auto w-1 h-1 rounded-full bg-primary/70" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Profile */}
      <div className="p-3 border-t border-white/[0.06]">
        <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/5 transition-colors group cursor-pointer">
          <div className="w-8 h-8 rounded-lg bg-white/8 border border-white/10 flex items-center justify-center text-xs font-semibold text-white/70 flex-shrink-0">
            {user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-xs font-medium text-white/70 truncate group-hover:text-white/90 transition-colors">
              {user?.full_name || 'Admin'}
            </span>
            <span className="text-[10px] text-white/25 truncate">
              {user?.email || ''}
            </span>
          </div>
          <button
            onClick={logout}
            className="p-1.5 text-white/20 hover:text-rose-400 rounded-md transition-colors opacity-0 group-hover:opacity-100"
            title="Sign out"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
