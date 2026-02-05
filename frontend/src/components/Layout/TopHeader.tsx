import { useState } from 'react';
import { Link } from 'react-router-dom';

interface TopHeaderProps {
  breadcrumbs?: { label: string; path?: string }[];
}

export default function TopHeader({ breadcrumbs }: TopHeaderProps) {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <header className="h-14 flex items-center justify-between px-6 bg-ray-surface/40 backdrop-blur-xl border-b border-white/5 flex-shrink-0 z-50">
      {/* Breadcrumbs / Context */}
      <div className="flex items-center gap-1.5 text-[13px] font-medium">
        {breadcrumbs ? (
          breadcrumbs.map((crumb, index) => (
            <div key={index} className="flex items-center gap-1.5">
              {index > 0 && <span className="text-ray-muted">/</span>}
              {crumb.path ? (
                <Link to={crumb.path} className="text-ray-muted hover:text-ray-text transition-colors">
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-ray-text">{crumb.label}</span>
              )}
            </div>
          ))
        ) : (
          <>
            <Link to="/" className="text-ray-muted hover:text-ray-text transition-colors">
              Home
            </Link>
            <span className="text-ray-muted">/</span>
            <span className="text-ray-text">Dashboard</span>
          </>
        )}
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-3">
        {/* Command-like Search */}
        <div className="relative group hidden md:block">
          <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 text-ray-muted group-focus-within:text-ray-primary transition-colors">
            <span className="material-symbols-outlined text-[18px]">search</span>
          </span>
          <input
            className="pl-9 pr-3 py-1.5 w-48 bg-white/5 border border-white/10 rounded-ray-button text-[13px] text-ray-text placeholder-ray-muted outline-none focus:border-ray-blue/40 focus:w-64 focus:bg-white/10 focus:shadow-[0_0_15px_rgba(88,166,255,0.1)] transition-all duration-300 backdrop-blur-md"
            placeholder="Search..."
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="absolute right-2 top-1.2 flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-ray-border bg-ray-surface-elevated text-[10px] text-ray-muted font-mono pointer-events-none">
            <span>⌘K</span>
          </div>
        </div>

        {/* Notifications */}
        <button className="p-1.5 text-ray-muted hover:text-ray-text hover:bg-white/5 rounded-ray-button transition-colors relative" aria-label="Notifications">
          <span className="material-symbols-outlined text-[20px]">notifications</span>
          <span className="absolute top-1.5 right-1.5 size-1.5 bg-ray-primary rounded-full shadow-[0_0_4px_rgba(255,99,99,0.5)]"></span>
        </button>
      </div>
    </header>
  );
}
