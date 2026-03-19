import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { cn } from '../../utils/cn';

export function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-panw-gray-50">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((prev) => !prev)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div
        className={cn(
          'flex flex-col transition-all duration-300',
          // On mobile, no margin (sidebar overlays). On desktop, shift for sidebar.
          'ml-0 lg:ml-64',
          sidebarCollapsed && 'lg:ml-16'
        )}
      >
        <Header onMobileMenuToggle={() => setMobileOpen(true)} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
