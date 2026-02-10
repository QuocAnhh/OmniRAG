import type { ReactNode } from 'react';
import Sidebar from './Sidebar';
import TopHeader from './TopHeader';

interface LayoutProps {
  children: ReactNode;
  breadcrumbs?: { label: string; path?: string }[];
}

export default function Layout({ children, breadcrumbs }: LayoutProps) {
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
