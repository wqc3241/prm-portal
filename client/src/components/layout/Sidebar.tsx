import { NavLink } from 'react-router-dom';
import { cn } from '../../utils/cn';
import { useAuth } from '../../hooks/useAuth';
import {
  HomeIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
  UserGroupIcon,
  BanknotesIcon,
  CubeIcon,
  AcademicCapIcon,
  FolderIcon,
  Cog6ToothIcon,
  ChartBarIcon,
  ShieldCheckIcon,
  CheckBadgeIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  BuildingOfficeIcon,
  Bars3Icon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import type { UserRole } from '../../types';

interface NavItem {
  name: string;
  to: string;
  icon: React.ElementType;
  roles?: UserRole[];
  disabled?: boolean;
}

const mainNavItems: NavItem[] = [
  { name: 'Dashboard', to: '/', icon: HomeIcon },
  {
    name: 'Deals',
    to: '/deals',
    icon: CurrencyDollarIcon,
  },
  {
    name: 'Quotes',
    to: '/quotes',
    icon: DocumentTextIcon,
  },
  {
    name: 'Leads',
    to: '/leads',
    icon: UserGroupIcon,
  },
  {
    name: 'MDF',
    to: '/mdf',
    icon: BanknotesIcon,
  },
  { name: 'Products', to: '/products', icon: CubeIcon },
  {
    name: 'Training',
    to: '/training',
    icon: AcademicCapIcon,
  },
  {
    name: 'Library',
    to: '/library',
    icon: FolderIcon,
  },
];

const adminNavItems: NavItem[] = [
  {
    name: 'Partners',
    to: '/admin/partners',
    icon: BuildingOfficeIcon,
    roles: ['admin', 'channel_manager'],
  },
  {
    name: 'Approvals',
    to: '/admin/approvals',
    icon: CheckBadgeIcon,
    roles: ['admin', 'channel_manager'],
  },
  {
    name: 'Tiers',
    to: '/admin/tiers',
    icon: ShieldCheckIcon,
    roles: ['admin'],
  },
  {
    name: 'Analytics',
    to: '/analytics',
    icon: ChartBarIcon,
    roles: ['admin', 'channel_manager'],
  },
];

const bottomNavItems: NavItem[] = [
  { name: 'Settings', to: '/settings', icon: Cog6ToothIcon },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: SidebarProps) {
  const { hasRole } = useAuth();

  const filteredAdminItems = adminNavItems.filter(
    (item) => !item.roles || item.roles.some((r) => hasRole(r))
  );

  const sidebarContent = (
    <>
      {/* Logo area */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-white/10">
        {!collapsed && (
          <div className="min-w-0">
            <span className="text-lg font-bold tracking-tight text-white">
              PRM Portal
            </span>
            <p className="text-[10px] font-medium text-panw-teal tracking-widest uppercase">
              NextWave Partner Portal
            </p>
          </div>
        )}
        {collapsed && (
          <span className="text-lg font-bold text-panw-orange mx-auto">P</span>
        )}
        {/* Desktop collapse toggle */}
        <button
          onClick={onToggle}
          className="hidden lg:block p-1.5 rounded-md hover:bg-white/10 transition-colors"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronDoubleRightIcon className="h-5 w-5 text-white/70" />
          ) : (
            <ChevronDoubleLeftIcon className="h-5 w-5 text-white/70" />
          )}
        </button>
        {/* Mobile close button */}
        {mobileOpen && (
          <button
            onClick={onMobileClose}
            className="lg:hidden p-1.5 rounded-md hover:bg-white/10 transition-colors"
            aria-label="Close sidebar"
          >
            <XMarkIcon className="h-5 w-5 text-white/70" />
          </button>
        )}
      </div>

      {/* Main nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
        <NavSection items={mainNavItems} collapsed={collapsed} onNavigate={onMobileClose} />

        {filteredAdminItems.length > 0 && (
          <>
            <div className="pt-4 pb-2">
              {!collapsed && (
                <p className="px-3 text-[10px] font-semibold text-white/40 uppercase tracking-widest">
                  Admin
                </p>
              )}
              {collapsed && <hr className="border-white/10 mx-2" />}
            </div>
            <NavSection items={filteredAdminItems} collapsed={collapsed} onNavigate={onMobileClose} />
          </>
        )}
      </nav>

      {/* Bottom nav */}
      <div className="border-t border-white/10 py-4 px-2 space-y-1">
        <NavSection items={bottomNavItems} collapsed={collapsed} onNavigate={onMobileClose} />
      </div>
    </>
  );

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-panw-navy transition-transform duration-300 lg:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 hidden lg:flex flex-col bg-panw-navy text-white transition-all duration-300',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
}

function NavSection({
  items,
  collapsed,
  onNavigate,
}: {
  items: NavItem[];
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <>
      {items.map((item) => {
        const Icon = item.icon;

        if (item.disabled) {
          return (
            <div
              key={item.name}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-white/25 cursor-not-allowed',
                collapsed && 'justify-center px-2'
              )}
              title={collapsed ? `${item.name} (Coming soon)` : undefined}
            >
              <Icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
              {!collapsed && <span>{item.name}</span>}
              {!collapsed && (
                <span className="ml-auto text-[10px] bg-white/10 text-white/40 px-1.5 py-0.5 rounded">
                  Soon
                </span>
              )}
            </div>
          );
        }

        return (
          <NavLink
            key={item.name}
            to={item.to}
            end={item.to === '/'}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-white/10 text-white'
                  : 'text-white/60 hover:bg-white/5 hover:text-white',
                collapsed && 'justify-center px-2'
              )
            }
            title={collapsed ? item.name : undefined}
          >
            {({ isActive }) => (
              <>
                {/* Active indicator — orange left border */}
                {isActive && (
                  <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r-full bg-panw-orange" />
                )}
                <Icon className={cn(
                  'h-5 w-5 flex-shrink-0',
                  isActive && 'text-panw-orange'
                )} aria-hidden="true" />
                {!collapsed && <span>{item.name}</span>}
              </>
            )}
          </NavLink>
        );
      })}
    </>
  );
}
