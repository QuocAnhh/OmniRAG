import type { ReactNode } from 'react';
import Sidebar from './Sidebar';
import TopHeader from './TopHeader';

interface LayoutProps {
  children: ReactNode;
  breadcrumbs?: { label: string; path?: string }[];
  hideSidebar?: boolean;
}

export default function Layout({ children, breadcrumbs, hideSidebar = false }: LayoutProps) {
  if (hideSidebar) {
    return (
      <div className="flex h-full w-full overflow-hidden bg-background relative font-sans text-foreground">
        <main className="flex-1 flex flex-col h-full overflow-hidden relative">
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
            {children}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background font-sans text-foreground">
      <Sidebar />
      <main className="flex-1 flex flex-col h-full overflow-hidden relative bg-background/50">
        <TopHeader breadcrumbs={breadcrumbs} />
        <div className="flex-1 overflow-y-auto px-6 py-6 custom-scrollbar">
          <div className="mx-auto max-w-7xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
