import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Bell, LayoutGrid, ChevronRight } from 'lucide-react';

interface TopHeaderProps {
  breadcrumbs?: { label: string; path?: string }[];
}

export default function TopHeader({ breadcrumbs }: TopHeaderProps) {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <header className="h-16 flex items-center justify-between px-8 bg-background/40 backdrop-blur-2xl border-b border-white/5 sticky top-0 z-40 relative shadow-[0_4px_24px_rgba(0,0,0,0.2)]">
      {/* Subtle bottom glow */}
      <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent"></div>
      {/* Breadcrumbs */}
      <div className="flex items-center gap-1.5 text-sm font-medium text-slate-400 animate-in fade-in slide-in-from-left-2">
        {breadcrumbs ? (
          breadcrumbs.map((crumb, index) => (
            <div key={index} className="flex items-center gap-1.5">
              {index > 0 && <ChevronRight className="w-4 h-4 text-slate-600" />}
              {crumb.path ? (
                <Link
                  to={crumb.path}
                  className="hover:text-blue-400 transition-colors"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-slate-200 font-semibold">{crumb.label}</span>
              )}
            </div>
          ))
        ) : (
          <div className="flex items-center gap-1.5">
            <Link to="/" className="hover:text-blue-400 transition-colors">
              Home
            </Link>
            <ChevronRight className="w-4 h-4 text-slate-600" />
            <span className="text-slate-200 font-semibold">Playgrounds</span>
          </div>
        )}
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="relative group hidden md:block">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500 group-focus-within:text-blue-400 transition-colors">
            <Search className="w-4 h-4" />
          </span>
          <input
            className="pl-9 pr-12 py-2 w-48 focus:w-64 bg-background/50 border border-white/10 hover:border-white/20 focus:bg-background/80 focus:ring-1 focus:ring-primary/50 focus:border-primary/50 rounded-full transition-all duration-300 text-sm text-foreground placeholder:text-muted-foreground outline-none shadow-inner shadow-black/50"
            placeholder="Search agents..."
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold text-muted-foreground border border-white/10 bg-background/80 shadow-inner">
            ⌘K
          </div>
        </div>

        <div className="h-6 w-px bg-white/10 mx-1"></div>

        {/* Notifications */}
        <button
          className="relative p-2 text-muted-foreground hover:text-foreground hover:bg-white/10 rounded-full transition-all focus:outline-none hover:shadow-[0_0_15px_rgba(255,255,255,0.1)]"
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1.5 size-2 bg-primary shadow-[0_0_8px_rgba(var(--primary),0.8)] rounded-full border-2 border-background"></span>
        </button>

        {/* Quick Actions */}
        <button
          className="p-2 text-muted-foreground hover:text-foreground hover:bg-white/10 rounded-full transition-all focus:outline-none hover:shadow-[0_0_15px_rgba(255,255,255,0.1)]"
          aria-label="Apps"
        >
          <LayoutGrid className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}
