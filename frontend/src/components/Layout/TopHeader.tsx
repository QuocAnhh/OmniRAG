import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Bell, LayoutGrid, ChevronRight } from 'lucide-react';

interface TopHeaderProps {
  breadcrumbs?: { label: string; path?: string }[];
}

export default function TopHeader({ breadcrumbs }: TopHeaderProps) {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <header className="h-16 flex items-center justify-between px-8 bg-white border-b border-[#e8e6dc] sticky top-0 z-40 relative">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-1.5 text-sm font-medium text-[#87867f] animate-in fade-in slide-in-from-left-2">
        {breadcrumbs ? (
          breadcrumbs.map((crumb, index) => (
            <div key={index} className="flex items-center gap-1.5">
              {index > 0 && <ChevronRight className="w-4 h-4 text-[#b0aea5]" />}
              {crumb.path ? (
                <Link
                  to={crumb.path}
                  className="hover:text-primary transition-colors"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-[#141413] font-semibold">{crumb.label}</span>
              )}
            </div>
          ))
        ) : (
          <div className="flex items-center gap-1.5">
            <Link to="/" className="hover:text-primary transition-colors">
              Home
            </Link>
            <ChevronRight className="w-4 h-4 text-[#b0aea5]" />
            <span className="text-[#141413] font-semibold">Playgrounds</span>
          </div>
        )}
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="relative group hidden md:block">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-[#87867f] group-focus-within:text-primary transition-colors">
            <Search className="w-4 h-4" />
          </span>
          <input
            className="pl-9 pr-12 py-2 w-48 focus:w-64 bg-[#f0eee6] border border-[#e8e6dc] hover:border-[#d1cfc5] focus:bg-white focus:ring-1 focus:ring-primary/30 focus:border-primary/50 rounded-full transition-all duration-300 text-sm text-[#141413] placeholder:text-[#87867f] outline-none"
            placeholder="Search agents..."
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold text-[#87867f] border border-[#e8e6dc] bg-white">
            ⌘K
          </div>
        </div>

        <div className="h-6 w-px bg-[#e8e6dc] mx-1"></div>

        {/* Notifications */}
        <button
          className="relative p-2 text-[#87867f] hover:text-[#141413] hover:bg-[#f0eee6] rounded-full transition-all focus:outline-none"
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1.5 size-2 bg-primary rounded-full border-2 border-white"></span>
        </button>

        {/* Quick Actions */}
        <button
          className="p-2 text-[#87867f] hover:text-[#141413] hover:bg-[#f0eee6] rounded-full transition-all focus:outline-none"
          aria-label="Apps"
        >
          <LayoutGrid className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}
