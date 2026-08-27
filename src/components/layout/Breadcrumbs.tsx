'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { usePathname } from 'next/navigation';

const labels: Record<string, string> = {
  shipments: 'Shipments',
  create: 'New shipment',
  settings: 'Profile & settings',
  events: 'Chain events',
};

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);
  const dashboardIndex = segments.indexOf('dashboard');
  const routeSegments = dashboardIndex >= 0 ? segments.slice(dashboardIndex + 1) : [];
  if (!routeSegments.length) return null;

  return (
    <nav aria-label="Breadcrumb" className="mb-5 flex items-center gap-1 text-xs text-gray-400">
      <Link href="/dashboard/shipments" className="hover:text-gray-700">Dashboard</Link>
      {routeSegments.map((segment, index) => {
        const href = `/${segments.slice(0, dashboardIndex + 2 + index).join('/')}`;
        const label = labels[segment] ?? (index > 0 ? segment : 'Shipments');
        const isLast = index === routeSegments.length - 1;
        return (
          <span key={`${segment}-${index}`} className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3 text-gray-300" />
            {isLast ? <span className="font-medium text-gray-600">{label}</span> : <Link href={href} className="hover:text-gray-700">{label}</Link>}
          </span>
        );
      })}
    </nav>
  );
}