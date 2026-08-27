'use client';

import { useEffect, useId, useRef, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Upload,
  ThumbsUp,
  XCircle,
  Loader2,
} from 'lucide-react';
import {
  submitProof,
  confirmMilestone,
  raiseDispute,
} from '@/lib/stellar/contract';
import { ArbiterPanel } from './ArbiterPanel';
import { useAuthStore } from '@/lib/hooks/use-auth-store';
import { milestoneStatusBadge, milestoneStatusLabel, stroopsToUsdc, cn } from '@/lib/utils';
import type { Shipment, Milestone, MilestoneStatus } from '@/types';

interface Props {
  shipment: Shipment;
  userRole: string;
  onUpdate: () => void;
}

export function MilestoneTimeline({ shipment, userRole, onUpdate }: Props) {
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  return (
    <div className="card divide-y divide-gray-50">
      {shipment.milestones.map((milestone, i) => (
        <MilestoneRow
          key={milestone.id}
          milestone={milestone}
          shipment={shipment}
          userRole={userRole}
          onUpdate={onUpdate}
          isLast={i === shipment.milestones.length - 1}
          onError={(msg) => setError(msg)}
        />
      ))}
      {error && (
        <div ref={errorRef} tabIndex={-1} className="p-4 bg-red-50 border-t border-red-100" role="alert" aria-live="assertive">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
    </div>
  );
}

function MilestoneRow({
  milestone,
  shipment,
  userRole,
  onUpdate,
  isLast,
  onError,
}: {
  milestone: Milestone;
  shipment: Shipment;
  userRole: string;
  onUpdate: () => void;
  isLast: boolean;
  onError: (msg: string) => void;
}) {
  const { address } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [proofInput, setProofInput] = useState('');
  const [showProofInput, setShowProofInput] = useState(false);

  const percent = milestone.paymentPercent;
  const totalUsdc = parseFloat(stroopsToUsdc(shipment.totalAmount));
  const milestoneUsdc = ((totalUsdc * percent) / 100).toFixed(2);

  const isActive = shipment.status === 'Active';

  const statusIcon: Record<MilestoneStatus, JSX.Element> = {
    Pending:        <Clock className="w-4 h-4 text-gray-400" />,
    ProofSubmitted: <Upload className="w-4 h-4 text-amber-500" />,
    Confirmed:      <CheckCircle2 className="w-4 h-4 text-green-500" />,
    Disputed:       <AlertTriangle className="w-4 h-4 text-red-500" />,
    Resolved:       <CheckCircle2 className="w-4 h-4 text-purple-500" />,
  };

  const wrap = async (fn: () => Promise<void>) => {
    if (!address || loading) return;
    setLoading(true);
    try {
      await fn();
      onUpdate();
    } catch (err: any) {
      onError(err?.message ?? 'Transaction failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitProof = () =>
    wrap(async () => {
      if (!proofInput.trim()) throw new Error('Please enter an IPFS hash or proof URL');
      await submitProof({
        callerAddress: address!,
        shipmentId: shipment.id,
        milestoneIndex: milestone.milestoneIndex,
        proofHash: proofInput.trim(),
      });
      setShowProofInput(false);
      setProofInput('');
    });

  const handleConfirm = () =>
    wrap(() =>
      confirmMilestone({
        callerAddress: address!,
        shipmentId: shipment.id,
        milestoneIndex: milestone.milestoneIndex,
      }),
    );

  const handleDispute = () =>
    wrap(() =>
      raiseDispute({
        callerAddress: address!,
        shipmentId: shipment.id,
        milestoneIndex: milestone.milestoneIndex,
      }),
    );

  const canSubmitProof =
    isActive &&
    milestone.status === 'Pending' &&
    (userRole === 'supplier' || userRole === 'logistics');

  const canConfirm =
    isActive &&
    milestone.status === 'ProofSubmitted' &&
    userRole === 'buyer';

  const canDispute =
    isActive &&
    milestone.status === 'ProofSubmitted' &&
    userRole === 'buyer';

  const isArbiterOnDisputed =
    isActive &&
    milestone.status === 'Disputed' &&
    address === shipment.arbiterAddress;

  return (
    <div className="p-5">
      <div className="flex items-start gap-4">
        {/* Status icon */}
        <div
          className={cn(
            'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
            milestone.status === 'Confirmed' || milestone.status === 'Resolved'
              ? 'bg-green-50'
              : milestone.status === 'Disputed'
              ? 'bg-red-50'
              : milestone.status === 'ProofSubmitted'
              ? 'bg-amber-50'
              : 'bg-gray-50',
          )}
          aria-hidden="true"
        >
          {statusIcon[milestone.status]}
        </div>

        <div className="flex-1 min-w-0">
          {/* Milestone header */}
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-sm font-medium text-gray-900">{milestone.name}</span>
            <span className={milestoneStatusBadge(milestone.status)}>
              {milestoneStatusLabel(milestone.status)}
            </span>
          </div>

          <p className="text-xs text-gray-400 mb-2">
            {percent}% of total — <span className="font-medium text-gray-600">${milestoneUsdc} USDC</span>
          </p>

          {/* Proof hash (if submitted) */}
          {milestone.proofHash && (
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-xs text-gray-400">Proof:</span>
              <a
                href={
                  milestone.proofHash.startsWith('ipfs://')
                    ? `https://ipfs.io/ipfs/${milestone.proofHash.replace('ipfs://', '')}`
                    : milestone.proofHash
                }
                target="_blank"
                rel="noreferrer"
                className="text-xs text-brand-600 hover:underline font-mono truncate max-w-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                aria-label="View proof hash (opens in new tab)"
              >
                {milestone.proofHash}
              </a>
            </div>
          )}

          {/* Payment released */}
          {milestone.paymentReleased && (
            <p className="text-xs text-green-600 font-medium mb-2">
              ✓ ${stroopsToUsdc(milestone.paymentReleased)} USDC released
            </p>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 mt-3">
            {loading && (
              <div className="flex items-center gap-1.5 text-xs text-gray-500" aria-live="polite" aria-label="Transaction in progress">
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                Waiting for Freighter…
              </div>
            )}

            {/* Submit proof */}
            {canSubmitProof && !loading && (
              <>
                {showProofInput ? (
                  <div className="flex items-center gap-2 w-full">
                    <input
                      type="text"
                      placeholder="ipfs://Qm... or https://..."
                      value={proofInput}
                      onChange={(e) => setProofInput(e.target.value)}
                      className="input flex-1 text-xs"
                      onKeyDown={(e) => e.key === 'Enter' && handleSubmitProof()}
                      aria-label="Proof hash input"
                    />
                    <button onClick={handleSubmitProof} className="btn-primary text-xs">
                      Submit
                    </button>
                    <button
                      onClick={() => setShowProofInput(false)}
                      className="btn-ghost text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowProofInput(true)}
                    className="btn-secondary text-xs"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Submit proof
                  </button>
                )}
              </>
            )}

            {/* Confirm / Dispute */}
            {!loading && (
              <>
                {canConfirm && (
                  <button onClick={handleConfirm} className="btn-primary text-xs">
                    <ThumbsUp className="w-3.5 h-3.5" />
                    Confirm & release
                  </button>
                )}
                {canDispute && (
                  <button onClick={handleDispute} className="btn-danger text-xs">
                    <XCircle className="w-3.5 h-3.5" />
                    Dispute
                  </button>
                )}
              </>
            )}

          </div>

          {/* Arbiter dispute panel */}
          {isArbiterOnDisputed && (
            <ArbiterPanel
              milestone={milestone}
              shipment={shipment}
              onUpdate={onUpdate}
            />
          )}
        </div>
      </div>
    </div>
  );
}
