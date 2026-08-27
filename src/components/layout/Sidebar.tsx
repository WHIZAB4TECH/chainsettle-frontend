'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Package,
  Bell,
  LogOut,
  ShieldCheck,
  Activity,
  X,
} from 'lucide-react';
import { useAuthStore } from '@/lib/hooks/use-auth-store';
import { notificationsApi } from '@/lib/api/services';
import { shortAddress } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

const NAV_ITEMS = [
  { href: '/dashboard/shipments', labelKey: 'shipments', icon: Package },
  { href: '/notifications', labelKey: 'notifications', icon: Bell },
  { href: '/dashboard/events', labelKey: 'chainEvents', icon: Activity },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { address, logout } = useAuthStore();
  const t = useTranslations('navigation');
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch unread count on mount and when returning from notifications page
  useEffect(() => {
    notificationsApi
      .list({ unreadOnly: true, limit: 1 })
      .then((res) => setUnreadCount(res.meta.total))
      .catch(() => {});
  }, [pathname]);

  const badgeLabel = unreadCount > 99 ? '99+' : String(unreadCount);

  return (
    <aside
      className={cn(
        'no-print',
        // Base styles
        'w-60 bg-white border-r border-gray-100 flex flex-col flex-shrink-0',
        // Mobile: fixed drawer that slides in/out
        'fixed inset-y-0 left-0 z-30 transition-transform duration-300 ease-in-out',
        'md:relative md:translate-x-0 md:z-auto md:transition-none',
        open ? 'translate-x-0' : '-translate-x-full',
      )}
    >
      {/* Logo + close button (close only visible on mobile) */}
      <div className="px-5 py-5 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-brand-600 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-gray-900 text-sm">ChainSettle</span>
        </div>
        <button
          onClick={onClose}
          className="md:hidden p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors"
          aria-label="Close sidebar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map(({ href, labelKey, icon: Icon }) => {
          const active = pathname.startsWith(href);
          const isNotifications = labelKey === 'notifications';
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                active
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
              )}
            >
              <Icon className={cn('w-4 h-4', active ? 'text-brand-600' : 'text-gray-400')} />
              {t(labelKey)}
              {isNotifications && unreadCount > 0 && (
                <span className="ml-auto inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold leading-none">
                  {badgeLabel}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="px-3 py-4 border-t border-gray-100">
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-gray-50 mb-2">
          <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-semibold text-brand-700">
              {address?.slice(0, 2) ?? 'G'}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-900 truncate">
              {address ? shortAddress(address) : 'Not connected'}
            </p>
            <p className="text-[10px] text-gray-400">{t('network', { network: t('testnet') })}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-sm text-gray-500 hover:bg-gray-50 hover:text-red-600 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          {t('signOut')}
        </button>
      </div>
    </aside>
  );
}
