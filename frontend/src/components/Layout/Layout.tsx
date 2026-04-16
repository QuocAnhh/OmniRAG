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
      <div className="flex h-screen w-full overflow-hidden bg-background relative font-sans text-foreground selection:bg-primary/20 selection:text-foreground">
        <main className="flex-1 flex flex-col h-full overflow-hidden relative">
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
            {children}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground font-sans selection:bg-primary/20 selection:text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-white focus:rounded-comfort focus:m-2"
      >
        Skip to content
      </a>
      <Sidebar />
      <main id="main-content" className="flex-1 flex flex-col h-full overflow-hidden relative">
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
