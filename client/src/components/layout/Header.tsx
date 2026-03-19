import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, MenuButton, MenuItem, MenuItems, Transition } from '@headlessui/react';
import {
  MagnifyingGlassIcon,
  UserCircleIcon,
  ArrowRightOnRectangleIcon,
  Cog6ToothIcon,
  Bars3Icon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../../hooks/useAuth';
import { getInitials } from '../../utils/formatters';
import { cn } from '../../utils/cn';
import { TierBadge } from '../shared/TierBadge';
import { NotificationBell } from '../notifications/NotificationBell';

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  admin: { label: 'Admin', color: 'bg-red-100 text-red-700' },
  channel_manager: { label: 'Channel Mgr', color: 'bg-purple-100 text-purple-700' },
  partner_admin: { label: 'Partner Admin', color: 'bg-panw-lightblue/10 text-panw-blue' },
  partner_rep: { label: 'Partner Rep', color: 'bg-panw-teal/10 text-panw-teal' },
};

interface HeaderProps {
  onMobileMenuToggle?: () => void;
}

export function Header({ onMobileMenuToggle }: HeaderProps) {
  const { user, logout } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
  };

  const roleMeta = user?.role ? ROLE_LABELS[user.role] : null;

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-panw-gray-200 bg-white px-4 sm:px-6 lg:px-8">
      {/* Mobile hamburger */}
      <button
        type="button"
        className="lg:hidden -ml-1 p-2 text-panw-gray-500 hover:text-panw-gray-700 rounded-md"
        onClick={onMobileMenuToggle}
        aria-label="Open sidebar"
      >
        <Bars3Icon className="h-6 w-6" />
      </button>

      {/* Search bar */}
      <div className="flex flex-1 items-center">
        <button
          type="button"
          className="sm:hidden p-2 text-panw-gray-400 hover:text-panw-gray-500"
          onClick={() => setSearchOpen(!searchOpen)}
          aria-label="Toggle search"
        >
          <MagnifyingGlassIcon className="h-5 w-5" />
        </button>
        <div className="hidden sm:block w-full max-w-md">
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <MagnifyingGlassIcon
                className="h-5 w-5 text-panw-gray-400"
                aria-hidden="true"
              />
            </div>
            <input
              type="search"
              placeholder="Search deals, quotes, leads..."
              className="block w-full rounded-md border-0 py-1.5 pl-10 pr-3 text-panw-gray-800 ring-1 ring-inset ring-panw-gray-200 placeholder:text-panw-gray-400 focus:ring-2 focus:ring-inset focus:ring-panw-blue sm:text-sm sm:leading-6"
              aria-label="Global search"
            />
          </div>
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Tier badge for partners */}
        {user?.organization?.tier && (
          <TierBadge name={user.organization.tier.name} size="sm" />
        )}

        {/* Notifications */}
        <NotificationBell />

        {/* User menu */}
        <Menu as="div" className="relative">
          <MenuButton className="flex items-center gap-2 rounded-full focus:outline-none focus:ring-2 focus:ring-panw-blue focus:ring-offset-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-panw-navy text-white text-sm font-semibold">
              {getInitials(user?.first_name, user?.last_name)}
            </div>
            <div className="hidden md:block text-left">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-panw-gray-800">
                  {user?.first_name} {user?.last_name}
                </p>
                {roleMeta && (
                  <span className={cn(
                    'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold',
                    roleMeta.color
                  )}>
                    {roleMeta.label}
                  </span>
                )}
              </div>
              {user?.organization && (
                <p className="text-xs text-panw-gray-400 truncate max-w-[160px]">
                  {user.organization.name}
                </p>
              )}
            </div>
          </MenuButton>

          <Transition
            as={Fragment}
            enter="transition ease-out duration-100"
            enterFrom="transform opacity-0 scale-95"
            enterTo="transform opacity-100 scale-100"
            leave="transition ease-in duration-75"
            leaveFrom="transform opacity-100 scale-100"
            leaveTo="transform opacity-0 scale-95"
          >
            <MenuItems className="absolute right-0 z-10 mt-2 w-56 origin-top-right rounded-md bg-white py-1 shadow-panw-lg ring-1 ring-black/5 focus:outline-none">
              <div className="px-4 py-3 border-b border-panw-gray-100">
                <p className="text-sm font-medium text-panw-gray-800">
                  {user?.first_name} {user?.last_name}
                </p>
                <p className="text-xs text-panw-gray-400 truncate">{user?.email}</p>
                {user?.organization && (
                  <p className="text-xs text-panw-gray-400 mt-0.5 truncate">
                    {user.organization.name}
                  </p>
                )}
                {roleMeta && (
                  <span className={cn(
                    'mt-1.5 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold',
                    roleMeta.color
                  )}>
                    {roleMeta.label}
                  </span>
                )}
              </div>
              <MenuItem>
                {({ focus }) => (
                  <Link
                    to="/settings"
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 text-sm text-panw-gray-700',
                      focus && 'bg-panw-gray-50'
                    )}
                  >
                    <Cog6ToothIcon className="h-4 w-4" />
                    Settings
                  </Link>
                )}
              </MenuItem>
              <MenuItem>
                {({ focus }) => (
                  <Link
                    to="/profile"
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 text-sm text-panw-gray-700',
                      focus && 'bg-panw-gray-50'
                    )}
                  >
                    <UserCircleIcon className="h-4 w-4" />
                    Profile
                  </Link>
                )}
              </MenuItem>
              <div className="border-t border-panw-gray-100">
                <MenuItem>
                  {({ focus }) => (
                    <button
                      onClick={handleLogout}
                      className={cn(
                        'flex w-full items-center gap-2 px-4 py-2 text-sm text-panw-gray-700',
                        focus && 'bg-panw-gray-50'
                      )}
                    >
                      <ArrowRightOnRectangleIcon className="h-4 w-4" />
                      Sign out
                    </button>
                  )}
                </MenuItem>
              </div>
            </MenuItems>
          </Transition>
        </Menu>
      </div>

      {/* Mobile search -- conditionally shown */}
      {searchOpen && (
        <div className="absolute inset-x-0 top-16 bg-white border-b border-panw-gray-200 p-3 sm:hidden">
          <input
            type="search"
            placeholder="Search deals, quotes, leads..."
            className="block w-full rounded-md border-0 py-1.5 pl-3 pr-3 text-panw-gray-800 ring-1 ring-inset ring-panw-gray-200 placeholder:text-panw-gray-400 focus:ring-2 focus:ring-inset focus:ring-panw-blue text-sm"
            autoFocus
            aria-label="Mobile search"
          />
        </div>
      )}
    </header>
  );
}
