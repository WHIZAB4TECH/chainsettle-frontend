'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Download, Plus, Package, Search, SlidersHorizontal, X } from 'lucide-react';
import { shipmentsApi } from '@/lib/api/services';
import { useAuthStore } from '@/lib/hooks/use-auth-store';
import { ShipmentCard } from '@/components/shipments/ShipmentCard';
import { ShipmentCardSkeleton } from '@/components/shipments/ShipmentCardSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { Pagination } from '@/components/Pagination';
import type { Shipment, ShipmentStatus } from '@/types';
import { useTranslations } from 'next-intl';

const PAGE_LIMIT = 10;

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
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [address, statusFilter, page]);

  useEffect(() => {
    if (!address) return;

    const loadCounts = async () => {
      try {
        const [allRes, activeRes, completedRes, cancelledRes] = await Promise.all([
          shipmentsApi.list({ buyerAddress: address, page: 1, limit: 1 }),
          shipmentsApi.list({ buyerAddress: address, status: 'Active', page: 1, limit: 1 }),
          shipmentsApi.list({ buyerAddress: address, status: 'Completed', page: 1, limit: 1 }),
          shipmentsApi.list({ buyerAddress: address, status: 'Cancelled', page: 1, limit: 1 }),
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
            const count = statusCounts[tab.label as keyof typeof statusCounts] ?? 0;

            return (
              <button
                key={tab.label}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => {
                  const params = new URLSearchParams(searchParams as any);
                  if (tab.value) {
                    params.set('status', tab.value);
                  } else {
                    params.delete('status');
                  }
                  router.replace(`/dashboard/shipments${params.toString() ? `?${params.toString()}` : ''}`);
                }}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${
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
            <Link href="/dashboard/shipments/create" className="btn-primary inline-flex">
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
            <Link href="/dashboard/shipments/create" className="btn-primary inline-flex">
              <Plus className="w-4 h-4" />
              {t('newShipment')}
            </Link>
          }
        />
      ) : (
        <>
          <div className="space-y-3">
            {filtered.map((shipment) => (
              <ShipmentCard key={shipment.id} shipment={shipment} />
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

export default function ShipmentsPage() {
  return (
    <Suspense fallback={<div className="h-64" />}>
      <ShipmentsPageContent />
    </Suspense>
  );
}
