import type { ReactNode } from 'react';
import Sidebar from './Sidebar';
import TopHeader from './TopHeader';

interface LayoutProps {
  children: ReactNode;
  breadcrumbs?: { label: string; path?: string }[];
}

export default function Layout({ children, breadcrumbs }: LayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-transparent text-ray-text">
      <Sidebar />
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <TopHeader breadcrumbs={breadcrumbs} />
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
