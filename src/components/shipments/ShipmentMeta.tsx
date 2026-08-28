'use client';
import { Copy } from 'lucide-react';
import { copyToClipboard, formatDate } from '@/lib/utils';
import { StellarLink } from '@/components/StellarLink';
import type { Shipment } from '@/types';

export function ShipmentMeta({ shipment }: { shipment: Shipment }) {
  const rows = [
    { label: 'Buyer', value: shipment.buyerAddress, type: 'account' as const },
    { label: 'Supplier', value: shipment.supplierAddress, type: 'account' as const },
    { label: 'Logistics', value: shipment.logisticsAddress, type: 'account' as const },
    { label: 'Arbiter', value: shipment.arbiterAddress, type: 'account' as const },
    { label: 'USDC contract', value: shipment.tokenAddress, type: 'account' as const },
    { label: 'Created', value: null, display: formatDate(shipment.createdAt) },
    { label: 'Tx hash', value: shipment.txHash, type: 'tx' as const },
  ];

  return (
    <div className="card p-5">
      <h2 className="text-sm font-semibold text-gray-900 mb-4">Details</h2>
      <div className="space-y-2.5">
        {rows.map(({ label, value, display }) => (
          <div key={label} className="flex items-center justify-between text-xs">
            <span className="text-gray-400 w-32 flex-shrink-0">{label}</span>
            {value ? (
              <div className="flex items-center gap-1.5 min-w-0">
                <StellarLink value={value} type={label === 'Tx hash' ? 'tx' : 'account'} className="font-mono text-blue-600 hover:text-blue-800 truncate" />
                <button
                  onClick={() => copyToClipboard(value)}
                  aria-label={`Copy ${label.toLowerCase()} to clipboard`}
                  className="text-gray-300 hover:text-gray-600 transition-colors flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
                >
                  <Copy className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <span className="text-gray-700">{display ?? '—'}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
