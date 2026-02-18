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
  { path: '/analytics', label: 'Analytics', icon: 'leaderboard' },
  { path: '/settings', label: 'Settings', icon: 'settings' },

];

export default function Sidebar() {
  const location = useLocation();
  const { user, logout } = useAuthStore();

  const isActive = (path: string) => location.pathname === path;

  return (
    <aside className="w-64 flex-shrink-0 bg-muted/30 border-r border-border/60 flex flex-col h-full relative z-20 backdrop-blur-xl">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 gap-3 border-b border-border/40">
        <div className="size-9 rounded-xl overflow-hidden border border-border bg-card flex items-center justify-center shadow-lg shadow-primary/10">
          <img src="/logo.png" alt="OmniRAG Logo" className="w-full h-full object-cover" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-foreground tracking-tight">OmniRAG</span>
          <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Workspace</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-1">
        <div className="px-2 mb-2 text-xs font-medium text-muted-foreground/60 uppercase tracking-widest">
          Main Menu
        </div>
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`
              flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group
              ${isActive(item.path)
                ? 'bg-primary/10 text-primary-700 dark:text-primary-300 shadow-sm'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
              }
            `}
          >
            <span
              className={`material-symbols-outlined text-[20px] transition-transform duration-300 
                ${isActive(item.path) ? 'fill-current' : 'group-hover:scale-110'}
              `}
            >
              {item.icon}
            </span>
            <span>{item.label}</span>
            {isActive(item.path) && (
              <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            )}
          </Link>
        ))}
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-border/40 bg-muted/10">
        <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted/50 transition-colors group">
          <div className="size-9 rounded-full bg-accent flex items-center justify-center text-sm font-semibold text-accent-foreground shadow-sm ring-2 ring-background border border-border">
            {user?.full_name?.charAt(0) || 'U'}
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
              {user?.full_name || 'User'}
            </span>
            <span className="text-xs text-muted-foreground truncate">
              {user?.email || 'user@example.com'}
            </span>
          </div>
          <button
            onClick={logout}
            className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
            title="Logout"
          >
            <span className="material-symbols-outlined text-lg">logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
