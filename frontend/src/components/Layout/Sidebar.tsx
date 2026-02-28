import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { LayoutGrid, BotMessageSquare, Settings, LogOut, Hexagon, Component } from 'lucide-react';
import { LogoIcon } from '../ui/LogoIcon';

interface NavItem {
  path: string;
  label: string;
  icon: any; // Lucide icon component
}

const navItems: NavItem[] = [
  { path: '/bots', label: 'AI Agents', icon: BotMessageSquare },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  const location = useLocation();
  const { user, logout } = useAuthStore();

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <aside className="w-64 flex-shrink-0 bg-background/40 border-r border-white/5 flex flex-col h-full relative z-20 backdrop-blur-2xl shadow-[4px_0_24px_rgba(0,0,0,0.5)]">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 gap-3 border-b border-white/5 bg-transparent relative overflow-hidden">
        {/* Subtle glow effect behind logo */}
        <div className="absolute top-1/2 -translate-y-1/2 left-8 w-16 h-16 bg-blue-500/20 blur-[20px] rounded-full pointer-events-none"></div>
        <Link
          to="/"
          title="Back to Landing Page"
          className="flex items-center gap-3 group/logo flex-1 min-w-0"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/80 to-indigo-600/80 p-[1px] shadow-[0_0_15px_rgba(59,130,246,0.3)] group-hover/logo:shadow-[0_0_25px_rgba(59,130,246,0.5)] transition-all relative z-10">
            <div className="w-full h-full bg-background rounded-lg flex items-center justify-center backdrop-blur-sm overflow-hidden p-1.5">
              <LogoIcon className="w-full h-full" />
            </div>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-bold text-white tracking-tight group-hover/logo:text-blue-400 transition-colors">OmniRAG</span>
          </div>
          <div className="ml-auto px-1.5 py-0.5 rounded pl-1 pr-1 bg-white/5 text-[9px] uppercase tracking-widest text-slate-400 font-bold border border-white/10">v2</div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-6 flex flex-col gap-1.5 custom-scrollbar">
        <div className="px-3 mb-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
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
                flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 group relative overflow-hidden
                ${active
                  ? 'text-blue-400 bg-blue-500/10 border border-blue-500/20 shadow-[inset_0_0_20px_rgba(59,130,246,0.1)]'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent'
                }
              `}
            >
              <Icon className={`w-4 h-4 transition-transform duration-300 ${active ? '' : 'group-hover:scale-110'}`} />
              <span>{item.label}</span>
              {active && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-white/5 bg-background/20 backdrop-blur-md relative overflow-hidden">
        {/* Background ambient glow */}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-primary/5 to-transparent pointer-events-none"></div>
        <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/10 transition-colors group cursor-pointer relative z-10">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-sm font-semibold text-white shadow-inner border border-white/10">
            {user?.full_name?.charAt(0) || 'E'}
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-sm font-medium text-slate-200 truncate group-hover:text-white transition-colors">
              {user?.full_name || 'Enterprise Admin'}
            </span>
            <span className="text-xs text-slate-500 truncate">
              {user?.email || 'admin@omnirag.systems'}
            </span>
          </div>
          <button
            onClick={logout}
            className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
