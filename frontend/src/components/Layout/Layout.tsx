import type { ReactNode } from 'react';
import Sidebar from './Sidebar';
import TopHeader from './TopHeader';
import ParticleBackground from '../ui/ParticleBackground';

interface LayoutProps {
  children: ReactNode;
  breadcrumbs?: { label: string; path?: string }[];
  hideSidebar?: boolean;
}

export default function Layout({ children, breadcrumbs, hideSidebar = false }: LayoutProps) {
  if (hideSidebar) {
    return (
      <div className="flex h-screen w-full overflow-hidden bg-[#020205] relative font-sans text-slate-50 selection:bg-blue-500/30 selection:text-white">
        <ParticleBackground />
        <main className="flex-1 flex flex-col h-full overflow-hidden relative">
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
            {children}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#020205] text-slate-50 font-sans selection:bg-blue-500/30 selection:text-white">
      <ParticleBackground />

      <Sidebar />
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <TopHeader breadcrumbs={breadcrumbs} />
        <div className="flex-1 overflow-y-auto px-6 py-6 custom-scrollbar relative z-10">
          <div className="mx-auto max-w-7xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
