'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Trash2, Loader2, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { createShipment } from '@/lib/stellar/contract';
import { shipmentsApi } from '@/lib/api/services';
import { useAuthStore } from '@/lib/hooks/use-auth-store';
import { generateShipmentId, usdcToStroops } from '@/lib/utils';
import type { CreateMilestoneInput } from '@/types';

const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS!;
const DEFAULT_MILESTONES: CreateMilestoneInput[] = [
  { name: 'Goods Dispatched', paymentPercent: 25 },
  { name: 'In Transit', paymentPercent: 50 },
  { name: 'Delivered', paymentPercent: 25 },
];

type ShipmentDraft = {
  shipmentId: string;
  supplierAddress: string;
  logisticsAddress: string;
  arbiterAddress: string;
  totalUsdc: string;
  milestones: CreateMilestoneInput[];
};

export default function CreateShipmentPage() {
  const router = useRouter();
  const { address } = useAuthStore();

  const [shipmentId, setShipmentId] = useState(generateShipmentId);
  const [supplierAddress, setSupplierAddress] = useState('');
  const [logisticsAddress, setLogisticsAddress] = useState('');
  const [arbiterAddress, setArbiterAddress] = useState('');
  const [totalUsdc, setTotalUsdc] = useState('');
  const [milestones, setMilestones] = useState<CreateMilestoneInput[]>(DEFAULT_MILESTONES);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txStep, setTxStep] = useState('');
  const draftLoaded = useRef(false);

  useEffect(() => {
    if (!address) return;

    draftLoaded.current = false;
    const key = `chainsetttle_shipment_draft_${address}`;
    const savedDraft = localStorage.getItem(key);
    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft) as Partial<ShipmentDraft>;
        if (draft.shipmentId) setShipmentId(draft.shipmentId);
        if (typeof draft.supplierAddress === 'string') setSupplierAddress(draft.supplierAddress);
        if (typeof draft.logisticsAddress === 'string') setLogisticsAddress(draft.logisticsAddress);
        if (typeof draft.arbiterAddress === 'string') setArbiterAddress(draft.arbiterAddress);
        if (typeof draft.totalUsdc === 'string') setTotalUsdc(draft.totalUsdc);
        if (Array.isArray(draft.milestones) && draft.milestones.length) {
          setMilestones(draft.milestones);
        }
      } catch {
        localStorage.removeItem(key);
      }
    }
    draftLoaded.current = true;
  }, [address]);

  useEffect(() => {
    if (!address || !draftLoaded.current || loading) return;

    const timeout = window.setTimeout(() => {
      const draft: ShipmentDraft = {
        shipmentId,
        supplierAddress,
        logisticsAddress,
        arbiterAddress,
        totalUsdc,
        milestones,
      };
      localStorage.setItem(`chainsetttle_shipment_draft_${address}`, JSON.stringify(draft));
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [address, shipmentId, supplierAddress, logisticsAddress, arbiterAddress, totalUsdc, milestones, loading]);

  const totalPercent = milestones.reduce((s, m) => s + m.paymentPercent, 0);
  const percentValid = totalPercent === 100;

  const addMilestone = () => {
    setMilestones([...milestones, { name: '', paymentPercent: 0 }]);
  };

  const removeMilestone = (i: number) => {
    setMilestones(milestones.filter((_, idx) => idx !== i));
  };

  const updateMilestone = (i: number, field: keyof CreateMilestoneInput, value: any) => {
    setMilestones(milestones.map((m, idx) => (idx === i ? { ...m, [field]: value } : m)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) return;
    setError(null);
    setLoading(true);

    try {
      // Step 1: Call the Soroban contract via Freighter
      setTxStep('Building transaction…');
      const txHash = await createShipment({
        callerAddress: address,
        shipmentId,
        supplier: supplierAddress,
        logistics: logisticsAddress,
        arbiter: arbiterAddress,
        tokenAddress: USDC_ADDRESS,
        totalAmount: usdcToStroops(totalUsdc),
        milestones,
      });

      // Step 2: Register with the backend
      setTxStep('Saving to backend…');
      await shipmentsApi.create({
        shipmentId,
        buyerAddress: address,
        supplierAddress,
        logisticsAddress,
        arbiterAddress,
        tokenAddress: USDC_ADDRESS,
        totalAmount: usdcToStroops(totalUsdc).toString(),
        milestones,
        txHash,
      });

      localStorage.removeItem(`chainsetttle_shipment_draft_${address}`);
      router.push(`/dashboard/shipments/${shipmentId}`);
    } catch (err: any) {
      setError(err?.message ?? 'Transaction failed. Please try again.');
    } finally {
      setLoading(false);
      setTxStep('');
    }
  };

  return (
    <div className="max-w-2xl">
      <Link
        href="/dashboard/shipments"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-5 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </Link>

      <h1 className="text-xl font-semibold text-gray-900 mb-1">New shipment</h1>
      <p className="text-sm text-gray-500 mb-6">
        Lock USDC in a Soroban escrow contract. Payment releases automatically as milestones are confirmed.
      </p>
      <p className="text-xs text-gray-400 mb-5">Your unfinished form is saved locally in this browser.</p>

      {error && (
        <div className="mb-5 p-4 rounded-xl bg-red-50 border border-red-100 flex gap-3">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Shipment ID */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Shipment details</h2>
          <div className="space-y-4">
            <div>
              <label className="label">Shipment ID</label>
              <input value={shipmentId} readOnly className="input bg-gray-50 text-gray-500 font-mono text-xs" />
              <p className="text-xs text-gray-400 mt-1">Auto-generated — unique identifier on-chain</p>
            </div>
            <div>
              <label className="label">Total amount (USDC)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 5000"
                value={totalUsdc}
                onChange={(e) => setTotalUsdc(e.target.value)}
                required
                className="input"
              />
            </div>
          </div>
        </div>

        {/* Parties */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Parties</h2>
          <div className="space-y-4">
            <div>
              <label className="label">Your address (buyer)</label>
              <input value={address ?? ''} readOnly className="input bg-gray-50 text-gray-500 font-mono text-xs" />
            </div>
            <div>
              <label className="label">Supplier Stellar address</label>
              <input
                placeholder="G..."
                value={supplierAddress}
                onChange={(e) => setSupplierAddress(e.target.value)}
                required
                className="input font-mono text-xs"
              />
            </div>
            <div>
              <label className="label">Logistics Stellar address</label>
              <input
                placeholder="G..."
                value={logisticsAddress}
                onChange={(e) => setLogisticsAddress(e.target.value)}
                required
                className="input font-mono text-xs"
              />
            </div>
            <div>
              <label className="label">Arbiter Stellar address</label>
              <input
                placeholder="G..."
                value={arbiterAddress}
                onChange={(e) => setArbiterAddress(e.target.value)}
                required
                className="input font-mono text-xs"
              />
              <p className="text-xs text-gray-400 mt-1">
                Resolves disputes. Can be a trusted third party or a DAO address.
              </p>
            </div>
          </div>
        </div>

        {/* Milestones */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Milestones</h2>
              <p className={`text-xs mt-1 ${percentValid ? 'text-green-700' : 'text-red-600'}`}>
                {percentValid
                  ? 'Milestone percentages add up to 100%.'
                  : 'Milestone percentages must sum to 100%.'}
              </p>
            </div>
            <span
              className={`text-xs font-medium px-2 py-1 rounded-lg ${
                percentValid ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}
            >
              {totalPercent}% / 100%
            </span>
          </div>

          <div className="space-y-3 mb-4">
            {milestones.map((m, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 text-xs font-semibold flex items-center justify-center flex-shrink-0">
                  {i + 1}
                </div>
                <input
                  placeholder="Milestone name"
                  value={m.name}
                  onChange={(e) => updateMilestone(i, 'name', e.target.value)}
                  required
                  className="input flex-1"
                />
                <div className="relative w-24">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    step="1"
                    value={m.paymentPercent}
                    onChange={(e) => updateMilestone(i, 'paymentPercent', Number(e.target.value))}
                    required
                    className="input pr-7"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                </div>
                {milestones.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeMilestone(i)}
                    className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <button type="button" onClick={addMilestone} className="btn-ghost text-xs">
            <Plus className="w-3.5 h-3.5" />
            Add milestone
          </button>
        </div>

        {/* Submit */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={loading || !percentValid}
            className="btn-primary flex-1"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {txStep || 'Processing…'}
              </>
            ) : (
              'Sign & lock funds in escrow'
            )}
          </button>
          <Link href="/dashboard/shipments" className="btn-secondary">
            Cancel
          </Link>
        </div>

        <p className="text-xs text-gray-400 text-center">
          This will open Freighter to sign the transaction. USDC will be locked in the contract until milestones are confirmed.
        </p>
      </form>
    </div>
  );
}
