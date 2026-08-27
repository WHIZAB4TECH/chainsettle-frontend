"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Download,
  X,
  Plus,
  Package,
  Search,
} from "lucide-react";
import { shipmentsApi } from "@/lib/api/services";
import { cancelShipment } from "@/lib/stellar/contract";
import { useAuthStore } from "@/lib/hooks/use-auth-store";
import { ShipmentCardSkeleton } from "@/components/shipments/ShipmentCardSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { Pagination } from "@/components/Pagination";
import type { Shipment, ShipmentStatus } from "@/types";
import { formatDate, shipmentStatusBadge, stroopsToUsdc } from "@/lib/utils";

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

export default function ShipmentsPage() {
  const { address } = useAuthStore();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ShipmentStatus | "">("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusCounts, setStatusCounts] = useState({
    All: 0,
    Active: 0,
    Completed: 0,
    Cancelled: 0,
  });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [bulkActionError, setBulkActionError] = useState<string | null>(null);

  const requestedSort = searchParams?.get("sort");
  const requestedDirection = searchParams?.get("direction");
  const sortKey: SortKey = validSortKeys.includes(requestedSort as SortKey)
    ? (requestedSort as SortKey)
    : "createdAt";
  const sortDirection: SortDirection = validSortDirections.includes(
    requestedDirection as SortDirection,
  )
    ? (requestedDirection as SortDirection)
    : "desc";

  const statusTabs: Array<{ label: string; value: ShipmentStatus | "" }> = [
    { label: "All", value: "" },
    { label: "Active", value: "Active" },
    { label: "Completed", value: "Completed" },
    { label: "Cancelled", value: "Cancelled" },
  ];

  const validStatusValues = ["Active", "Completed", "Cancelled"];

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
              status: "Active",
              page: 1,
              limit: 1,
            }),
            shipmentsApi.list({
              buyerAddress: address,
              status: "Completed",
              page: 1,
              limit: 1,
            }),
            shipmentsApi.list({
              buyerAddress: address,
              status: "Cancelled",
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

    setStatusFilter(paramStatus as ShipmentStatus | "");
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
            {(statusFilter ? statusCounts[statusFilter] : statusCounts.All) ||
              shipments.length}{" "}
            shipment
            {((statusFilter ? statusCounts[statusFilter] : statusCounts.All) ||
              shipments.length) !== 1
              ? "s"
              : ""}{" "}
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
                    params.set("status", tab.value);
                  } else {
                    params.delete("status");
                  }
                  router.replace(
                    `/dashboard/shipments${params.toString() ? `?${params.toString()}` : ""}`,
                  );
                }}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
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
      {bulkActionError && (
        <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {bulkActionError}
        </div>
      )}
      {selectedIds.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-100 bg-brand-50 px-4 py-3">
          <p className="text-sm font-medium text-brand-900">
            {selectedIds.length} shipment{selectedIds.length === 1 ? "" : "s"}{" "}
            selected
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={exportSelected}
              className="btn-secondary text-xs"
            >
              <Download className="h-3.5 w-3.5" />
              Export selected
            </button>
            {canBulkCancel && cancellableShipments.length > 0 && (
              <button
                type="button"
                onClick={() => setCancelModalOpen(true)}
                className="btn-danger text-xs"
              >
                Cancel {cancellableShipments.length} selected
              </button>
            )}
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="btn-ghost text-xs"
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </button>
          </div>
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
          <div className="card overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 bg-gray-50/70 text-xs text-gray-500">
                <tr>
                  <th className="w-12 px-5 py-3 font-medium">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleAllVisible}
                      aria-label="Select all visible shipments"
                    />
                  </th>
                  <th className="px-5 py-3 font-medium">Shipment</th>
                  <th className="px-5 py-3 font-medium">Supplier</th>
                  {(["status", "amount", "createdAt"] as SortKey[]).map(
                    (key) => (
                      <th
                        key={key}
                        aria-sort={
                          sortKey === key
                            ? sortDirection === "asc"
                              ? "ascending"
                              : "descending"
                            : "none"
                        }
                        className="px-5 py-3 font-medium"
                      >
                        <button
                          type="button"
                          onClick={() => updateSort(key)}
                          className="inline-flex items-center gap-1.5 hover:text-gray-900"
                          aria-label={`Sort by ${sortLabels[key]}`}
                        >
                          {sortLabels[key]}
                          {sortIcon(key)}
                        </button>
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedShipments.map((shipment) => (
                  <tr key={shipment.id} className="hover:bg-gray-50">
                    <td className="px-5 py-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(shipment.id)}
                        onChange={() => toggleSelection(shipment.id)}
                        aria-label={`Select shipment ${shipment.id}`}
                      />
                    </td>
                    <td className="px-5 py-4">
                      <Link
                        href={`/dashboard/shipments/${shipment.id}`}
                        className="font-mono text-xs font-semibold text-gray-900 hover:text-brand-600"
                      >
                        {shipment.id}
                      </Link>
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-gray-500">
                      {shipment.supplierAddress.slice(0, 5)}...
                      {shipment.supplierAddress.slice(-4)}
                    </td>
                    <td className="px-5 py-4">
                      <span className={shipmentStatusBadge(shipment.status)}>
                        {shipment.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-medium tabular-nums text-gray-900">
                      ${stroopsToUsdc(shipment.totalAmount)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-gray-500">
                      {formatDate(shipment.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
