import { Fragment, useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BellIcon } from '@heroicons/react/24/outline';
import {
  useNotifications,
  useUnreadCount,
  useMarkRead,
  useMarkAllRead,
} from '../../hooks/useNotifications';
import { cn } from '../../utils/cn';
import {
  CurrencyDollarIcon,
  DocumentTextIcon,
  UserGroupIcon,
  BanknotesIcon,
  AcademicCapIcon,
  ShieldCheckIcon,
  InformationCircleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import type { Notification } from '../../types';

const NOTIFICATION_ICONS: Record<string, React.ElementType> = {
  deal_submitted: CurrencyDollarIcon,
  deal_approved: CheckCircleIcon,
  deal_rejected: XCircleIcon,
  deal_expired: ExclamationTriangleIcon,
  quote_approved: DocumentTextIcon,
  quote_rejected: DocumentTextIcon,
  lead_assigned: UserGroupIcon,
  lead_sla_warning: ExclamationTriangleIcon,
  mdf_approved: BanknotesIcon,
  mdf_rejected: BanknotesIcon,
  cert_expiring: AcademicCapIcon,
  cert_completed: AcademicCapIcon,
  tier_changed: ShieldCheckIcon,
  system: InformationCircleIcon,
  info: InformationCircleIcon,
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;

  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const { data: unreadCount } = useUnreadCount();
  const { data: notifData } = useNotifications({
    per_page: 5,
    sort: 'created_at:desc',
  });
  const notifications = notifData?.data ?? [];

  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  // Close panel on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleNotificationClick = (notif: Notification) => {
    if (!notif.is_read) {
      markRead.mutate(notif.id);
    }
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="relative rounded-full p-1.5 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-panw-blue focus:ring-offset-2"
        aria-label="View notifications"
      >
        <BellIcon className="h-6 w-6" aria-hidden="true" />
        {(unreadCount ?? 0) > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {(unreadCount ?? 0) > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 z-50 mt-2 w-80 sm:w-96 origin-top-right rounded-lg bg-white shadow-lg ring-1 ring-black/5"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">
              Notifications
            </h3>
            {(unreadCount ?? 0) > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
                className="text-xs font-medium text-panw-navy hover:text-panw-blue"
              >
                Mark All Read
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <BellIcon className="mx-auto h-8 w-8 text-gray-300" />
                <p className="mt-2 text-sm text-gray-500">
                  No notifications yet
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-50">
                {notifications.map((notif) => {
                  const Icon =
                    NOTIFICATION_ICONS[notif.type] ?? InformationCircleIcon;
                  return (
                    <li
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif)}
                      className={cn(
                        'px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors',
                        !notif.is_read && 'bg-blue-50/50'
                      )}
                    >
                      <div className="flex gap-3">
                        <div
                          className={cn(
                            'flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center',
                            !notif.is_read
                              ? 'bg-navy-100 text-panw-blue'
                              : 'bg-gray-100 text-gray-500'
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            className={cn(
                              'text-sm',
                              !notif.is_read
                                ? 'font-semibold text-gray-900'
                                : 'text-gray-700'
                            )}
                          >
                            {notif.title}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                            {notif.message}
                          </p>
                          <p className="text-[10px] text-gray-400 mt-1">
                            {timeAgo(notif.created_at)}
                          </p>
                        </div>
                        {!notif.is_read && (
                          <div className="flex-shrink-0 mt-1">
                            <div className="h-2 w-2 rounded-full bg-navy-600" />
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-100 px-4 py-2.5">
            <Link
              to="/notifications"
              onClick={() => setOpen(false)}
              className="block text-center text-sm font-medium text-panw-navy hover:text-panw-blue"
            >
              View All Notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
