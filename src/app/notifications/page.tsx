'use client';

import { useEffect, useState } from 'react';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';
import { notificationsApi } from '@/lib/api/services';
import { EmptyState } from '@/components/EmptyState';
import { timeAgo } from '@/lib/utils';
import { useAuthStore } from '@/lib/hooks/use-auth-store';
import type { Notification } from '@/types';

export default function NotificationsPage() {
  const preferences = useAuthStore((state) => state.notificationPreferences);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    notificationsApi
      .list()
      .then((res) => setNotifications(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleMarkAllRead = async () => {
    await notificationsApi.markAllRead();
    load();
  };

  const handleMarkRead = async (id: string) => {
    await notificationsApi.markRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
  };

  const visibleNotifications = notifications.filter((notification) => {
    const type = notification.type.toLowerCase();
    if (type.includes('milestone') || type.includes('proof') || type.includes('dispute')) return preferences.milestoneUpdates;
    if (type.includes('system') || type.includes('account')) return preferences.systemAlerts;
    return preferences.shipmentUpdates;
  });
  const unreadCount = visibleNotifications.filter((n) => !n.read).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Notifications</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button onClick={handleMarkAllRead} className="btn-secondary text-xs">
            <CheckCheck className="w-3.5 h-3.5" />
            Mark all read
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-5 h-5 text-gray-300 animate-spin" />
        </div>
      ) : visibleNotifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No notifications yet"
          description="You're all caught up. We'll notify you when something needs your attention."
        />
      ) : (
        <div className="card divide-y divide-gray-50">
          {visibleNotifications.map((n) => (
            <div
              key={n.id}
              onClick={() => !n.read && handleMarkRead(n.id)}
              className={`p-4 flex items-start gap-3 cursor-pointer transition-colors ${
                n.read ? 'opacity-60' : 'hover:bg-gray-50'
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full flex-shrink-0 mt-2 ${
                  n.read ? 'bg-gray-200' : 'bg-brand-600'
                }`}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 mb-0.5">{n.title}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{n.message}</p>
                <p className="text-[10px] text-gray-400 mt-1">{timeAgo(n.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
