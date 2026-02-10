import { useState } from 'react';
import { Link } from 'react-router-dom';

interface TopHeaderProps {
  breadcrumbs?: { label: string; path?: string }[];
}

export default function TopHeader({ breadcrumbs }: TopHeaderProps) {
  const [searchQuery, setSearchQuery] = useState('');


  return (
    <header className="h-16 flex items-center justify-between px-8 bg-background/80 backdrop-blur-md border-b border-border/40 sticky top-0 z-40">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground animate-in fade-in slide-in-from-left-2">
        {breadcrumbs ? (
          breadcrumbs.map((crumb, index) => (
            <div key={index} className="flex items-center gap-2">
              {index > 0 && <span className="text-muted-foreground/40">/</span>}
              {crumb.path ? (
                <Link
                  to={crumb.path}
                  className="hover:text-primary transition-colors hover:underline underline-offset-4 decoration-primary/30"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-foreground font-semibold">{crumb.label}</span>
              )}
            </div>
          ))
        ) : (
          <div className="flex items-center gap-2">
            <Link to="/" className="hover:text-primary transition-colors hover:underline underline-offset-4 decoration-primary/30">
              Home
            </Link>
            <span className="text-muted-foreground/40">/</span>
            <span className="text-foreground font-semibold">Dashboard</span>
          </div>
        )}
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="relative group hidden md:block">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground group-focus-within:text-primary transition-colors">
            <span className="material-symbols-outlined text-[20px]">search</span>
          </span>
          <input
            className="pl-9 pr-12 py-2 w-48 focus:w-64 bg-muted/30 border-transparent hover:bg-muted/50 focus:bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary/30 rounded-full transition-all duration-300 text-sm placeholder:text-muted-foreground/70"
            placeholder="Search..."
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold text-muted-foreground/60 border border-border/50 bg-background/50">
            ⌘K
          </div>
        </div>

        <div className="h-6 w-px bg-border/60 mx-1"></div>

        {/* Notifications */}
        <button
          className="relative p-2.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-primary/20"
          aria-label="Notifications"
        >
          <span className="material-symbols-outlined text-[20px]">notifications</span>
          <span className="absolute top-2 right-2 size-2 bg-accent-500 rounded-full ring-2 ring-background"></span>
        </button>

        {/* Quick Actions */}
        <button
          className="p-2.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-primary/20"
          aria-label="Apps"
        >
          <span className="material-symbols-outlined text-[20px]">apps</span>
        </button>
      </div>
    </header>
  );
}
