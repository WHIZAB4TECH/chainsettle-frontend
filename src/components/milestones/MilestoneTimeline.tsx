'use client';

import { useState } from 'react';
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
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string | null>(null);

  const selectMilestone = (milestoneId: string) => {
    setSelectedMilestoneId(milestoneId);
    document.getElementById(`milestone-${milestoneId}`)?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  };

  return (
    <div>
      <div className="card mb-4 p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">Progress</h3>
          <span className="text-xs text-gray-400">Select a milestone to view details</span>
        </div>
        <div className="flex flex-col md:flex-row md:items-start">
          {shipment.milestones.map((milestone, index) => (
            <div key={milestone.id} className="flex md:flex-1 items-start">
              <button
                type="button"
                onClick={() => selectMilestone(milestone.id)}
                aria-label={`View ${milestone.name}, ${milestoneStatusLabel(milestone.status)}`}
                className={cn(
                  'group flex items-center gap-3 text-left md:flex-col md:gap-2 md:items-center md:w-full',
                  selectedMilestoneId === milestone.id && 'text-brand-700',
                )}
              >
                <span className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1 ring-inset transition-colors',
                  milestone.status === 'Confirmed' || milestone.status === 'Resolved'
                    ? 'bg-green-50 ring-green-200'
                    : milestone.status === 'ProofSubmitted'
                    ? 'bg-amber-50 ring-amber-200'
                    : milestone.status === 'Disputed'
                    ? 'bg-red-50 ring-red-200'
                    : 'bg-gray-50 ring-gray-200',
                )}>
                  {stepStatusIcon(milestone.status)}
                </span>
                <span className="min-w-0 pb-3 md:pb-0 md:text-center">
                  <span className="block truncate max-w-[13rem] text-xs font-medium text-gray-800 group-hover:text-brand-700">
                    {milestone.name}
                  </span>
                  <span className="block text-[11px] text-gray-400 mt-0.5">
                    {milestoneStatusLabel(milestone.status)}
                  </span>
                </span>
              </button>
              {index < shipment.milestones.length - 1 && (
                <span className="ml-4 mt-4 h-8 w-px bg-gray-200 md:mx-3 md:mt-4 md:h-px md:w-full" />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="card divide-y divide-gray-50">
        {shipment.milestones.map((milestone, i) => (
          <MilestoneRow
            key={milestone.id}
            milestone={milestone}
            shipment={shipment}
            userRole={userRole}
            onUpdate={onUpdate}
            isLast={i === shipment.milestones.length - 1}
            isSelected={selectedMilestoneId === milestone.id}
          />
        ))}
      </div>
    </div>
  );
}

function stepStatusIcon(status: MilestoneStatus) {
  if (status === 'Confirmed' || status === 'Resolved') {
    return <CheckCircle2 className="h-4 w-4 text-green-600" />;
  }
  if (status === 'ProofSubmitted') return <Upload className="h-4 w-4 text-amber-600" />;
  if (status === 'Disputed') return <AlertTriangle className="h-4 w-4 text-red-600" />;
  return <Clock className="h-4 w-4 text-gray-500" />;
}

function MilestoneRow({
  milestone,
  shipment,
  userRole,
  onUpdate,
  isSelected,
}: {
  milestone: Milestone;
  shipment: Shipment;
  userRole: string;
  onUpdate: () => void;
  isLast: boolean;
  isSelected: boolean;
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

  const wrap = async (fn: () => Promise<unknown>) => {
    if (!address || loading) return;
    setLoading(true);
    try {
      await fn();
      onUpdate();
    } catch (err: any) {
      alert(err?.message ?? 'Transaction failed');
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
    <div
      id={`milestone-${milestone.id}`}
      className={cn(
        'p-5 transition-colors duration-500',
        isSelected && 'bg-brand-50/50 ring-2 ring-inset ring-brand-200',
      )}
    >
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
                className="text-xs text-brand-600 hover:underline font-mono truncate max-w-xs"
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
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
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
