"use client";

import { useEffect, useState } from "react";
import { Loader2, Printer } from "lucide-react";
import { useParams } from "next/navigation";
import { shipmentsApi } from "@/lib/api/services";
import {
  milestoneStatusLabel,
  shipmentStatusBadge,
  stroopsToUsdc,
} from "@/lib/utils";
import type { Shipment } from "@/types";

export default function ShipmentPrintPage() {
  const { id } = useParams<{ id: string }>();
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    shipmentsApi
      .get(id)
      .then(setShipment)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!shipment) {
    return (
      <p className="py-16 text-center text-gray-500">Shipment not found.</p>
    );
  }

  return (
    <article className="print-page mx-auto max-w-3xl text-gray-900">
      <div className="mb-8 flex items-start justify-between border-b border-gray-200 pb-5">
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-gray-400">
            ChainSettle shipment
          </p>
          <h1 className="font-mono text-2xl font-semibold">{shipment.id}</h1>
          <p className="mt-1 text-sm text-gray-500">
            Created {new Date(shipment.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={shipmentStatusBadge(shipment.status)}>
            {shipment.status}
          </span>
          <button
            onClick={() => window.print()}
            className="no-print btn-primary text-xs"
          >
            <Printer className="h-3.5 w-3.5" />
            Print / Export PDF
          </button>
        </div>
      </div>

      <section className="mb-8 grid grid-cols-2 gap-4 border-b border-gray-200 pb-6 sm:grid-cols-4">
        <Summary
          label="Total amount"
          value={`$${stroopsToUsdc(shipment.totalAmount)} USDC`}
        />
        <Summary
          label="Released"
          value={`$${stroopsToUsdc(shipment.releasedAmount)} USDC`}
        />
        <Summary
          label="Milestones"
          value={`${shipment.milestones.filter((milestone) => milestone.status === "Confirmed" || milestone.status === "Resolved").length} / ${shipment.milestones.length} complete`}
        />
        <Summary
          label="Created ledger"
          value={shipment.createdLedger?.toString() ?? "N/A"}
        />
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold">Parties</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Detail label="Buyer" value={shipment.buyerAddress} />
          <Detail label="Supplier" value={shipment.supplierAddress} />
          <Detail label="Logistics" value={shipment.logisticsAddress} />
          <Detail label="Arbiter" value={shipment.arbiterAddress} />
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold">Milestones</h2>
        <div className="divide-y divide-gray-200 border-y border-gray-200">
          {shipment.milestones.map((milestone) => (
            <div key={milestone.id} className="py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">
                  {milestone.milestoneIndex + 1}. {milestone.name}
                </span>
                <span className="text-sm text-gray-500">
                  {milestone.paymentPercent}% ·{" "}
                  {milestoneStatusLabel(milestone.status)}
                </span>
              </div>
              {milestone.proofHash && (
                <p className="mt-1 break-all font-mono text-xs text-gray-500">
                  Proof: {milestone.proofHash}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-2 border-t border-gray-200 pt-4 text-xs text-gray-500">
        <Detail label="USDC contract" value={shipment.tokenAddress} />
        {shipment.txHash && (
          <Detail label="Transaction" value={shipment.txHash} />
        )}
      </section>
    </article>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="break-all font-mono text-xs">{value}</p>
    </div>
  );
}
