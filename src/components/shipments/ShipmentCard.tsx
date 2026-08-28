// components/shipments/ShipmentCard.tsx
'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { shipmentStatusBadge, stroopsToUsdc, timeAgo, shortAddress, shipmentProgress } from '@/lib/utils';
import type { Shipment } from '@/types';

export function ShipmentCard({ shipment }: { shipment: Shipment }) {
  const progress = shipmentProgress(shipment.milestones);
  const totalUsdc = stroopsToUsdc(shipment.totalAmount);
  const releasedUsdc = stroopsToUsdc(shipment.releasedAmount);

  return (
    <Link href={`/dashboard/shipments/${shipment.id}`} aria-label={`Shipment ${shipment.id}, ${shipment.status}, $${totalUsdc} total`}>
      <div className="card p-5 hover:shadow-md hover:border-gray-200 transition-all cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-gray-900 font-mono">{shipment.id}</span>
              <span className={shipmentStatusBadge(shipment.status)}>{shipment.status}</span>
            </div>
            <p className="text-xs text-gray-400">
              Supplier: {shortAddress(shipment.supplierAddress)} · {timeAgo(shipment.createdAt)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-gray-900">${totalUsdc}</p>
            <p className="text-xs text-gray-400">${releasedUsdc} released</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-100 rounded-full h-1.5 mb-2" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label={`${progress}% complete`}>
          <div
            className="bg-brand-600 h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400">
            {shipment.milestones.filter((m) => m.status === 'Confirmed' || m.status === 'Resolved').length}
            /{shipment.milestones.length} milestones done
          </p>
          <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-brand-600 transition-colors" aria-hidden="true" />
        </div>
      </div>
    </Link>
  );
}
