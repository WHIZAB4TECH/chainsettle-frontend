'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Download, Plus, Package, Search, SlidersHorizontal, X } from 'lucide-react';
import { shipmentsApi } from '@/lib/api/services';
import { cancelShipment } from '@/lib/stellar/contract';
import { useAuthStore } from '@/lib/hooks/use-auth-store';
import { ShipmentCard } from '@/components/shipments/ShipmentCard';
import { ShipmentCardSkeleton } from '@/components/shipments/ShipmentCardSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { Pagination } from '@/components/Pagination';
import { stroopsToUsdc } from '@/lib/utils';
import type { Shipment, ShipmentStatus } from '@/types';
import { useTranslations } from 'next-intl';

const PAGE_LIMIT = 10;
type SortKey = "createdAt" | "status" | "amount";
type SortDirection = "asc" | "desc";

const sortLabels: Record<SortKey, string> = {
  createdAt: "Created",
  status: "Status",
  amount: "Amount",
};
const validSortKeys: SortKey[] = ["createdAt", "status", "amount"];
const validSortDirections: SortDirection[] = ["asc", "desc"];

function ShipmentsPageContent() {
  const { address } = useAuthStore();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ShipmentStatus | ''>('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [dateField, setDateField] = useState<'created' | 'updated'>('created');
  const [counterpartyRole, setCounterpartyRole] = useState('');
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
  const searchInputRef = useRef<HTMLInputElement>(null);

  const t = useTranslations('dashboard');
  const statusTabs: Array<{ label: string; value: ShipmentStatus | '' }> = [
    { label: t('tabs.all'), value: '' },
    { label: t('tabs.active'), value: 'Active' },
    { label: t('tabs.completed'), value: 'Completed' },
    { label: t('tabs.cancelled'), value: 'Cancelled' },
  ];

  const validStatusValues = ['Active', 'Completed', 'Cancelled'];
  const counterpartyRoles = [
    { label: 'Any role', value: '' },
    { label: 'Buyer', value: 'buyer' },
    { label: 'Supplier', value: 'supplier' },
    { label: 'Logistics', value: 'logistics' },
    { label: 'Arbiter', value: 'arbiter' },
  ];

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
    const paramStatus = searchParams?.get("status") ?? "";
    if (paramStatus && !validStatusValues.includes(paramStatus)) {
      setStatusFilter("");
      return;
    }

    setStatusFilter(paramStatus as ShipmentStatus | '');
    setFromDate(searchParams?.get('from') ?? '');
    setToDate(searchParams?.get('to') ?? '');
    setDateField(searchParams?.get('date') === 'updated' ? 'updated' : 'created');
    setCounterpartyRole(searchParams?.get('role') ?? '');
  }, [searchParams]);

  useEffect(() => {
    if (searchParams?.get('focus') !== 'search') return;
    searchInputRef.current?.focus();
    router.replace('/dashboard/shipments');
  }, [router, searchParams]);

  // Reset to page 1 when search or filter changes
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, fromDate, toDate, dateField, counterpartyRole]);

  const updateFilterUrl = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.replace(`/dashboard/shipments${params.toString() ? `?${params.toString()}` : ''}`);
  };

  const clearAdvancedFilters = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('from');
    params.delete('to');
    params.delete('date');
    params.delete('role');
    router.replace(`/dashboard/shipments${params.toString() ? `?${params.toString()}` : ''}`);
  };

  const hasAdvancedFilters = fromDate || toDate || dateField !== 'created' || counterpartyRole;

  const filtered = shipments.filter((shipment) => {
    const matchesSearch =
      shipment.id.toLowerCase().includes(search.toLowerCase()) ||
      shipment.supplierAddress.toLowerCase().includes(search.toLowerCase());
    const filterDate = (dateField === 'updated' ? shipment.updatedAt : shipment.createdAt).slice(0, 10);
    const matchesFrom = !fromDate || filterDate >= fromDate;
    const matchesTo = !toDate || filterDate <= toDate;
    const roleAddress = counterpartyRole
      ? shipment[`${counterpartyRole}Address` as 'buyerAddress' | 'supplierAddress' | 'logisticsAddress' | 'arbiterAddress']
      : '';
    const matchesRole = !counterpartyRole || Boolean(roleAddress && roleAddress !== address);
    return matchesSearch && matchesFrom && matchesTo && matchesRole;
  });

  const exportCsv = () => {
    const columns = [
      'Shipment ID', 'Status', 'Created At', 'Updated At', 'Buyer',
      'Supplier', 'Logistics', 'Arbiter', 'Total Amount', 'Released Amount',
    ];
    const escapeCsv = (value: string | number | null) => {
      const text = String(value ?? '');
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const rows = filtered.map((shipment) => [
      shipment.id,
      shipment.status,
      shipment.createdAt,
      shipment.updatedAt,
      shipment.buyerAddress,
      shipment.supplierAddress,
      shipment.logisticsAddress,
      shipment.arbiterAddress,
      shipment.totalAmount,
      shipment.releasedAmount,
    ]);
    const csv = [columns, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n');
    const blob = new Blob([`${csv}\n`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `chainsettle-shipments-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const sortedShipments = useMemo(
    () =>
      [...filtered].sort((left, right) => {
        let comparison = 0;
        if (sortKey === "createdAt") {
          comparison =
            new Date(left.createdAt).getTime() -
            new Date(right.createdAt).getTime();
        } else if (sortKey === "amount") {
          const leftAmount = BigInt(left.totalAmount);
          const rightAmount = BigInt(right.totalAmount);
          comparison =
            leftAmount < rightAmount ? -1 : leftAmount > rightAmount ? 1 : 0;
        } else {
          comparison = left.status.localeCompare(right.status);
        }
        return sortDirection === "asc" ? comparison : -comparison;
      }),
    [filtered, sortKey, sortDirection],
  );

  const selectedShipments = sortedShipments.filter((shipment) =>
    selectedIds.includes(shipment.id),
  );
  const cancellableShipments = selectedShipments.filter(
    (shipment) =>
      shipment.buyerAddress === address &&
      shipment.status === "Active" &&
      !shipment.milestones.some(
        (milestone) =>
          milestone.status === "Confirmed" || milestone.status === "Resolved",
      ),
  );
  const allVisibleSelected =
    sortedShipments.length > 0 &&
    sortedShipments.every((shipment) => selectedIds.includes(shipment.id));

  useEffect(() => {
    setSelectedIds((current) =>
      current.filter((id) => shipments.some((shipment) => shipment.id === id)),
    );
  }, [shipments]);

  const toggleSelection = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((selectedId) => selectedId !== id)
        : [...current, id],
    );
  };

  const toggleAllVisible = () => {
    setSelectedIds((current) =>
      allVisibleSelected
        ? current.filter(
            (id) => !sortedShipments.some((shipment) => shipment.id === id),
          )
        : Array.from(
            new Set([
              ...current,
              ...sortedShipments.map((shipment) => shipment.id),
            ]),
          ),
    );
  };

  const exportSelected = () => {
    const header = [
      "Shipment ID",
      "Supplier",
      "Status",
      "Amount (USDC)",
      "Created",
    ];
    const rows = selectedShipments.map((shipment) => [
      shipment.id,
      shipment.supplierAddress,
      shipment.status,
      stroopsToUsdc(shipment.totalAmount),
      shipment.createdAt,
    ]);
    const csv = [header, ...rows]
      .map((row) =>
        row.map((value) => `"${value.replaceAll('"', '""')}"`).join(","),
      )
      .join("\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "chainsettle-shipments.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const performBulkCancel = async () => {
    if (!address) return;
    setBulkActionLoading(true);
    setBulkActionError(null);
    try {
      const cancelledIds = new Set(
        cancellableShipments.map((shipment) => shipment.id),
      );
      for (const shipment of cancellableShipments) {
        await cancelShipment({
          callerAddress: address,
          shipmentId: shipment.id,
        });
        await shipmentsApi.sync(shipment.id);
      }
      setSelectedIds((current) =>
        current.filter((id) => !cancelledIds.has(id)),
      );
      setCancelModalOpen(false);
    } catch (err: any) {
      setBulkActionError(
        err?.message ?? "Some shipments could not be cancelled.",
      );
    } finally {
      setBulkActionLoading(false);
    }
  };

  const updateSort = (nextKey: SortKey) => {
    const params = new URLSearchParams(searchParams as any);
    const nextDirection =
      sortKey === nextKey && sortDirection === "asc" ? "desc" : "asc";
    params.set("sort", nextKey);
    params.set("direction", nextDirection);
    router.replace(`/dashboard/shipments?${params.toString()}`);
  };

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key)
      return <ArrowUpDown className="w-3.5 h-3.5 text-gray-300" />;
    return sortDirection === "asc" ? (
      <ArrowUp className="w-3.5 h-3.5 text-brand-600" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-brand-600" />
    );
  };

  const canBulkCancel = Boolean(address);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Shipments</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {t('shipmentCount', {
              count: (statusFilter ? statusCounts[statusFilter] : statusCounts.All) || shipments.length,
            })}
          </p>
        </div>
        <Link href="/dashboard/shipments/create" className="btn-primary">
          <Plus className="w-4 h-4" />
          {t('newShipment')}
        </Link>
      </div>

      {/* Filters */}
      <div className="mb-5 space-y-4">
        <div className="flex items-center gap-3 flex-wrap" role="tablist" aria-label="Filter shipments by status">
          {statusTabs.map((tab) => {
            const isActive = tab.value === statusFilter;
            const count =
              statusCounts[tab.label as keyof typeof statusCounts] ?? 0;

            return (
              <button
                key={tab.label}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => {
                  const params = new URLSearchParams(searchParams as any);
                  if (tab.value) {
                    params.set("status", tab.value);
                  } else {
                    params.delete("status");
                  }
                  router.replace(
                    `/dashboard/shipments${params.toString() ? `?${params.toString()}` : ''}`,
                  );
                }}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${
                  isActive
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {tab.label} ({count})
              </button>
            );
          })}
        </div>

        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search shipments"
            className="input pl-9"
          />
        </div>

        <div className="flex items-end gap-3 flex-wrap rounded-xl border border-gray-100 bg-white p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mr-1">
            <SlidersHorizontal className="w-4 h-4 text-gray-400" />
            Advanced filters
          </div>
          <label className="text-xs text-gray-500">
            Date field
            <select
              value={dateField}
              onChange={(e) => updateFilterUrl('date', e.target.value === 'updated' ? 'updated' : 'created')}
              className="input mt-1 text-xs"
            >
              <option value="created">Created date</option>
              <option value="updated">Updated date</option>
            </select>
          </label>
          <label className="text-xs text-gray-500">
            From
            <input
              type="date"
              value={fromDate}
              onChange={(e) => updateFilterUrl('from', e.target.value)}
              className="input mt-1 text-xs"
            />
          </label>
          <label className="text-xs text-gray-500">
            To
            <input
              type="date"
              value={toDate}
              onChange={(e) => updateFilterUrl('to', e.target.value)}
              className="input mt-1 text-xs"
            />
          </label>
          <label className="text-xs text-gray-500">
            Counterparty role
            <select
              value={counterpartyRole}
              onChange={(e) => updateFilterUrl('role', e.target.value)}
              className="input mt-1 text-xs"
            >
              {counterpartyRoles.map((role) => (
                <option key={role.value} value={role.value}>{role.label}</option>
              ))}
            </select>
          </label>
          {hasAdvancedFilters && (
            <button type="button" onClick={clearAdvancedFilters} className="btn-ghost text-xs">
              <X className="w-3.5 h-3.5" />
              Clear
            </button>
          )}
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
        <div className="space-y-3" aria-busy="true" aria-label="Loading shipments">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <ShipmentCardSkeleton key={i} />
          ))}
        </div>
      ) : shipments.length === 0 ? (
        <EmptyState
          icon={Package}
          title={t('empty.title')}
          description={t('empty.description')}
          action={
            <Link
              href="/dashboard/shipments/create"
              className="btn-primary inline-flex"
            >
              <Plus className="w-4 h-4" />
              {t('newShipment')}
            </Link>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title={t('empty.noResultsTitle')}
          description={t('empty.noResultsDescription')}
          action={
            <Link
              href="/dashboard/shipments/create"
              className="btn-primary inline-flex"
            >
              <Plus className="w-4 h-4" />
              {t('newShipment')}
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

      {cancelModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4"
          role="presentation"
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="bulk-cancel-title"
          >
            <h2
              id="bulk-cancel-title"
              className="mb-2 text-lg font-semibold text-gray-900"
            >
              Cancel selected shipments?
            </h2>
            <p className="mb-5 text-sm leading-6 text-gray-500">
              This will submit cancellation transactions for{" "}
              {cancellableShipments.length} active shipment
              {cancellableShipments.length === 1 ? "" : "s"}. This action cannot
              be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCancelModalOpen(false)}
                disabled={bulkActionLoading}
                className="btn-secondary text-sm"
              >
                Keep shipments
              </button>
              <button
                type="button"
                onClick={() => void performBulkCancel()}
                disabled={bulkActionLoading}
                className="btn-danger text-sm"
              >
                {bulkActionLoading ? "Cancelling..." : "Cancel shipments"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ShipmentsPage() {
  return (
    <Suspense fallback={<div className="h-64" />}>
      <ShipmentsPageContent />
    </Suspense>
  );
}
