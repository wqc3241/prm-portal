import { useState, useCallback, useMemo } from 'react';
import {
  useNotifications,
  useMarkRead,
  useMarkAllRead,
  useDismissNotification,
} from '../../hooks/useNotifications';
import {
  PageHeader,
  Skeleton,
} from '../../components/shared';
import { cn } from '../../utils/cn';
import {
  BellIcon,
  TrashIcon,
  CheckIcon,
  EnvelopeIcon,
  EnvelopeOpenIcon,
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
import type { NotificationQueryParams } from '../../types/notification';

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

function formatNotificationDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getDateGroup(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  if (date >= today) return 'Today';
  if (date >= yesterday) return 'Yesterday';
  if (date >= weekAgo) return 'This Week';
  return 'Older';
}

type ReadFilter = 'all' | 'unread' | 'read';

const FILTER_TABS: { label: string; value: ReadFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Unread', value: 'unread' },
  { label: 'Read', value: 'read' },
];

export function NotificationList() {
  const [readFilter, setReadFilter] = useState<ReadFilter>('all');
  const [page, setPage] = useState(1);

  const params = useMemo<NotificationQueryParams>(() => {
    const p: NotificationQueryParams = {
      page,
      per_page: 25,
      sort: 'created_at:desc',
    };
    if (readFilter === 'unread') p.is_read = false;
    if (readFilter === 'read') p.is_read = true;
    return p;
  }, [page, readFilter]);

  const { data: notifData, isLoading } = useNotifications(params);
  const notifications = notifData?.data ?? [];
  const meta = notifData?.meta;

  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();
  const dismissNotification = useDismissNotification();

  const handleFilterChange = useCallback((filter: ReadFilter) => {
    setReadFilter(filter);
    setPage(1);
  }, []);

  // Group notifications by date
  const groupedNotifications = useMemo(() => {
    const groups: { label: string; items: Notification[] }[] = [];
    const groupMap = new Map<string, Notification[]>();

    for (const notif of notifications) {
      const group = getDateGroup(notif.created_at);
      if (!groupMap.has(group)) {
        groupMap.set(group, []);
      }
      groupMap.get(group)!.push(notif);
    }

    const order = ['Today', 'Yesterday', 'This Week', 'Older'];
    for (const label of order) {
      const items = groupMap.get(label);
      if (items && items.length > 0) {
        groups.push({ label, items });
      }
    }

    return groups;
  }, [notifications]);

  if (isLoading) {
    return (
      <div>
        <div className="mb-6">
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-5 w-40" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle="Stay updated on your deals, quotes, leads, and more"
        breadcrumbs={[{ label: 'Notifications' }]}
        actions={
          <button
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
            className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <CheckIcon className="h-4 w-4" />
            {markAllRead.isPending ? 'Marking...' : 'Mark All Read'}
          </button>
        }
      />

      {/* Filter tabs */}
      <div className="mb-4 flex flex-wrap gap-1 border-b border-gray-200 pb-3">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => handleFilterChange(tab.value)}
            className={cn(
              'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
              readFilter === tab.value
                ? 'bg-panw-blue text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Notifications */}
      {notifications.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <BellIcon className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-3 text-sm font-semibold text-gray-900">
            No notifications
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {readFilter !== 'all'
              ? `No ${readFilter} notifications found.`
              : "You're all caught up!"}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedNotifications.map((group) => (
            <div key={group.label}>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                {group.label}
              </h3>
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 divide-y divide-gray-100">
                {group.items.map((notif) => {
                  const Icon =
                    NOTIFICATION_ICONS[notif.type] ?? InformationCircleIcon;
                  return (
                    <div
                      key={notif.id}
                      className={cn(
                        'flex items-start gap-4 px-4 py-4',
                        !notif.is_read && 'bg-blue-50/30'
                      )}
                    >
                      <div
                        className={cn(
                          'flex-shrink-0 h-9 w-9 rounded-full flex items-center justify-center',
                          !notif.is_read
                            ? 'bg-navy-100 text-panw-blue'
                            : 'bg-gray-100 text-gray-500'
                        )}
                      >
                        <Icon className="h-4.5 w-4.5" />
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
                        <p className="text-sm text-gray-500 mt-0.5">
                          {notif.message}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {formatNotificationDate(notif.created_at)}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        {/* Mark read/unread toggle */}
                        <button
                          onClick={() => {
                            if (!notif.is_read) {
                              markRead.mutate(notif.id);
                            }
                          }}
                          disabled={notif.is_read || markRead.isPending}
                          className={cn(
                            'p-1.5 rounded-md transition-colors',
                            notif.is_read
                              ? 'text-gray-300 cursor-default'
                              : 'text-gray-400 hover:text-panw-blue hover:bg-gray-100'
                          )}
                          title={
                            notif.is_read ? 'Already read' : 'Mark as read'
                          }
                        >
                          {notif.is_read ? (
                            <EnvelopeOpenIcon className="h-4 w-4" />
                          ) : (
                            <EnvelopeIcon className="h-4 w-4" />
                          )}
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => dismissNotification.mutate(notif.id)}
                          disabled={dismissNotification.isPending}
                          className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Delete notification"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {meta && meta.total_pages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing {(meta.page - 1) * meta.per_page + 1} to{' '}
            {Math.min(meta.page * meta.per_page, meta.total)} of {meta.total}{' '}
            notifications
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-md bg-white px-3 py-1.5 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= meta.total_pages}
              className="rounded-md bg-white px-3 py-1.5 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
