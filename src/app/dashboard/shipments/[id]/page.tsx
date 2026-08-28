'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, RefreshCw, Loader2, Printer } from 'lucide-react';
import Link from 'next/link';
import { shipmentsApi } from '@/lib/api/services';
import { useAuthStore } from '@/lib/hooks/use-auth-store';
import { MilestoneTimeline } from '@/components/milestones/MilestoneTimeline';
import { ShipmentMeta } from '@/components/shipments/ShipmentMeta';
import { ShipmentProgress } from '@/components/shipments/ShipmentProgress';
import { shipmentStatusBadge, timeAgo, deriveUserRole, roleBadge } from '@/lib/utils';
import type { Shipment } from '@/types';

const POLL_INTERVAL_MS = 15_000;

export default function ShipmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { address } = useAuthStore();
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [secondsAgo, setSecondsAgo] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const loadingRef = useRef<HTMLDivElement>(null);

  const fetchShipment = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const data = await shipmentsApi.get(id);
      setShipment(data);
      setLastUpdated(new Date());
      setSecondsAgo(0);
      return data;
    } catch (err) {
      console.error(err);
      return null;
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  const startPolling = (currentShipment: Shipment) => {
    if (currentShipment.status !== "Active") return;

    intervalRef.current = setInterval(async () => {
      const updated = await fetchShipment(true);
      if (updated && updated.status !== "Active") {
        clearInterval(intervalRef.current!);
        intervalRef.current = null;
      }
    }, POLL_INTERVAL_MS);
  };

  useEffect(() => {
    fetchShipment(false).then((data) => {
      if (data) startPolling(data);
    });

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [id]);

  useEffect(() => {
    if (!lastUpdated) return;
    const tick = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastUpdated.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(tick);
  }, [lastUpdated]);

  useEffect(() => {
    if (loading && loadingRef.current) {
      loadingRef.current.focus();
    }
  }, [loading]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await shipmentsApi.sync(id);
      await fetchShipment(true);
    } finally {
      setSyncing(false);
    }
  };

  const onMilestoneUpdate = () => fetchShipment(true);

  if (loading) {
    return (
      <div ref={loadingRef} className="flex items-center justify-center h-64" tabIndex={-1} role="status" aria-live="polite" aria-label="Loading shipment details">
        <Loader2 className="w-6 h-6 text-gray-400 animate-spin" aria-hidden="true" />
      </div>
    );
  }

  if (!shipment) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">Shipment not found.</p>
        <Link
          href="/dashboard/shipments"
          className="btn-secondary mt-4 inline-flex"
        >
          Back to shipments
        </Link>
      </div>
    );
  }

  const userRole = deriveUserRole(address, shipment);
  const role = roleBadge(userRole);

  return (
    <div>
      {/* Back nav */}
      <Link
        href="/dashboard/shipments"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
      >
        <ArrowLeft className="w-4 h-4" />
        All shipments
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <h1 className="text-xl font-semibold text-gray-900">
              {shipment.id}
            </h1>
            <span className={shipmentStatusBadge(shipment.status)}>
              {shipment.status}
            </span>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${role.className}`}
            >
              {userRole === "observer"
                ? role.label
                : `Your role: ${role.label}`}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-xs text-gray-400">
              Created {timeAgo(shipment.createdAt)}
            </p>
            {lastUpdated && (
              <p className="text-xs text-gray-300">
                Last updated:{" "}
                {secondsAgo < 5 ? "just now" : `${secondsAgo}s ago`}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          aria-label={syncing ? 'Syncing from chain' : 'Sync from chain'}
          className="btn-secondary text-xs"
        >
          {syncing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
          )}
          Sync from chain
        </button>
      </div>

      {/* Progress bar */}
      <ShipmentProgress shipment={shipment} />

      {/* Milestones */}
      <div className="mt-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Milestones</h2>
        <MilestoneTimeline
          shipment={shipment}
          userRole={userRole}
          onUpdate={onMilestoneUpdate}
        />
      </div>

      {/* Meta */}
      <div className="mt-5">
        <ShipmentMeta shipment={shipment} />
      </div>
    </div>
  );
}
