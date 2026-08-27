'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Download, Loader2, Plus, Package, Search, X } from 'lucide-react';
import { shipmentsApi } from '@/lib/api/services';
import { cancelShipment } from '@/lib/stellar/contract';
import { useAuthStore } from '@/lib/hooks/use-auth-store';
import { ShipmentCard } from '@/components/shipments/ShipmentCard';
import { ShipmentCardSkeleton } from '@/components/shipments/ShipmentCardSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { Pagination } from '@/components/Pagination';
import { stroopsToUsdc } from '@/lib/utils';
import type { Shipment, ShipmentStatus } from '@/types';

const PAGE_LIMIT = 10;

export default function ShipmentsPage() {
  const { address } = useAuthStore();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ShipmentStatus | ''>('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [cancelling, setCancelling] = useState(false);
  const [statusCounts, setStatusCounts] = useState({
    All: 0,
    Active: 0,
    Completed: 0,
    Cancelled: 0,
  });

  const statusTabs: Array<{ label: string; value: ShipmentStatus | '' }> = [
    { label: 'All', value: '' },
    { label: 'Active', value: 'Active' },
    { label: 'Completed', value: 'Completed' },
    { label: 'Cancelled', value: 'Cancelled' },
  ];

  const validStatusValues = ['Active', 'Completed', 'Cancelled'];

  useEffect(() => {
    if (!address) return;
    setLoading(true);

    shipmentsApi
      .list({
        buyerAddress: address,
        status: statusFilter || undefined,
        page,
        limit: PAGE_LIMIT,
      })
      .then((res) => {
        setShipments(res.data);
        setTotalPages(res.meta.totalPages);
        setSelectedIds([]);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [address, statusFilter, page]);

  useEffect(() => {
    if (!address) return;

    const loadCounts = async () => {
      try {
        const [allRes, activeRes, completedRes, cancelledRes] =
          await Promise.all([
            shipmentsApi.list({ buyerAddress: address, page: 1, limit: 1 }),
            shipmentsApi.list({
              buyerAddress: address,
              status: 'Active',
              page: 1,
              limit: 1,
            }),
            shipmentsApi.list({
              buyerAddress: address,
              status: 'Completed',
              page: 1,
              limit: 1,
            }),
            shipmentsApi.list({
              buyerAddress: address,
              status: 'Cancelled',
              page: 1,
              limit: 1,
            }),
          ]);

        setStatusCounts({
          All: allRes.meta.total,
          Active: activeRes.meta.total,
          Completed: completedRes.meta.total,
          Cancelled: cancelledRes.meta.total,
        });
      } catch (err) {
        console.error(err);
      }
    };

    loadCounts();
  }, [address]);

  useEffect(() => {
    const paramStatus = searchParams?.get('status') ?? '';
    if (paramStatus && !validStatusValues.includes(paramStatus)) {
      setStatusFilter('');
      return;
    }

    setStatusFilter(paramStatus as ShipmentStatus | '');
  }, [searchParams]);

  // Reset to page 1 when search or filter changes
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const filtered = shipments.filter(
    (s) =>
      s.id.toLowerCase().includes(search.toLowerCase()) ||
      s.supplierAddress.toLowerCase().includes(search.toLowerCase()),
  );
  const visibleIds = useMemo(
    () => filtered.map((shipment) => shipment.id),
    [filtered],
  );
  const selectedShipments = shipments.filter((shipment) =>
    selectedIds.includes(shipment.id),
  );
  const cancellableShipments = selectedShipments.filter(
    (shipment) =>
      shipment.status === 'Active' &&
      shipment.buyerAddress === address &&
      !shipment.milestones.some(
        (milestone) => milestone.status === 'Confirmed',
      ),
  );
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

  const toggleSelection = (id: string, selected: boolean) => {
    setSelectedIds((current) =>
      selected
        ? [...new Set([...current, id])]
        : current.filter((item) => item !== id),
    );
  };

  const toggleSelectAll = () => {
    setSelectedIds((current) =>
      allVisibleSelected
        ? current.filter((id) => !visibleIds.includes(id))
        : [...new Set([...current, ...visibleIds])],
    );
  };

  const exportSelected = () => {
    const headers = [
      'Shipment ID',
      'Status',
      'Supplier',
      'Total USDC',
      'Created',
    ];
    const rows = selectedShipments.map((shipment) => [
      shipment.id,
      shipment.status,
      shipment.supplierAddress,
      stroopsToUsdc(shipment.totalAmount),
      shipment.createdAt,
    ]);
    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((value) => `"${String(value).replaceAll('"', '""')}"`)
          .join(','),
      )
      .join('\n');
    const url = URL.createObjectURL(
      new Blob([csv], { type: 'text/csv;charset=utf-8;' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'shipments.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const cancelSelected = async () => {
    if (!address || !cancellableShipments.length) return;
    const confirmed = window.confirm(
      `Cancel ${cancellableShipments.length} selected shipment${cancellableShipments.length === 1 ? '' : 's'}? This action cannot be undone.`,
    );
    if (!confirmed) return;

    setCancelling(true);
    try {
      for (const shipment of cancellableShipments) {
        await cancelShipment({
          callerAddress: address,
          shipmentId: shipment.id,
        });
        await shipmentsApi.sync(shipment.id);
      }
      setSelectedIds([]);
      const response = await shipmentsApi.list({
        buyerAddress: address,
        status: statusFilter || undefined,
        page,
        limit: PAGE_LIMIT,
      });
      setShipments(response.data);
    } catch (err) {
      console.error(err);
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Shipments</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {(statusFilter ? statusCounts[statusFilter] : statusCounts.All) ||
              shipments.length}{' '}
            shipment
            {((statusFilter ? statusCounts[statusFilter] : statusCounts.All) ||
              shipments.length) !== 1
              ? 's'
              : ''}{' '}
            found
          </p>
        </div>
        <Link href="/dashboard/shipments/create" className="btn-primary">
          <Plus className="w-4 h-4" />
          New shipment
        </Link>
      </div>

      {/* Filters */}
      <div className="mb-5 space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          {statusTabs.map((tab) => {
            const isActive = tab.value === statusFilter;
            const count =
              statusCounts[tab.label as keyof typeof statusCounts] ?? 0;

            return (
              <button
                key={tab.label}
                type="button"
                onClick={() => {
                  const params = new URLSearchParams(searchParams as any);
                  if (tab.value) {
                    params.set('status', tab.value);
                  } else {
                    params.delete('status');
                  }
                  router.replace(
                    `/dashboard/shipments${params.toString() ? `?${params.toString()}` : ''}`,
                  );
                }}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {tab.label} ({count})
              </button>
            );
          })}
        </div>

        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search shipment ID or address…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9"
          />
        </div>
      </div>

      {/* Shipments list */}
      {!loading && filtered.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={toggleSelectAll}
              className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            Select all visible
          </label>
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">
                {selectedIds.length} selected
              </span>
              <button
                type="button"
                onClick={exportSelected}
                className="btn-secondary text-xs"
              >
                <Download className="h-3.5 w-3.5" /> Export selected
              </button>
              {cancellableShipments.length > 0 && (
                <button
                  type="button"
                  onClick={cancelSelected}
                  disabled={cancelling}
                  className="btn-secondary text-xs text-red-600 hover:bg-red-50"
                >
                  {cancelling ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <X className="h-3.5 w-3.5" />
                  )}
                  Cancel selected
                </button>
              )}
            </div>
          )}
        </div>
      )}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <ShipmentCardSkeleton key={i} />
          ))}
        </div>
      ) : shipments.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No shipments yet"
          description="Create your first shipment to get started."
          action={
            <Link
              href="/dashboard/shipments/create"
              className="btn-primary inline-flex"
            >
              <Plus className="w-4 h-4" />
              New shipment
            </Link>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No results found"
          description="No shipments match your current search or filter."
          action={
            <Link
              href="/dashboard/shipments/create"
              className="btn-primary inline-flex"
            >
              <Plus className="w-4 h-4" />
              New shipment
            </Link>
          }
        />
      ) : (
        <>
          <div className="space-y-3">
            {filtered.map((shipment) => (
              <ShipmentCard
                key={shipment.id}
                shipment={shipment}
                selected={selectedIds.includes(shipment.id)}
                onSelect={(selected) => toggleSelection(shipment.id, selected)}
              />
            ))}
          </div>
          <Pagination
            page={page}
            totalPages={totalPages}
            onPrev={() => setPage((p) => p - 1)}
            onNext={() => setPage((p) => p + 1)}
          />
        </>
      )}
    </div>
  );
}
