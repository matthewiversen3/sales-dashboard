"use client";

import { Deal, Payment, Salesperson, SalesCall } from "@/lib/types";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Check, Phone, MessageSquare } from "lucide-react";

interface DealCardProps {
  deal: Deal;
  salesperson?: Salesperson;
  payments: Payment[];
  calls: SalesCall[];
  onClick: () => void;
}

export function DealCard({ deal, salesperson, payments, calls, onClick }: DealCardProps) {
  const totalPaid = payments.filter((p) => p.verified).reduce((s, p) => s + p.amount, 0);
  const totalOwed = deal.totalAmount - totalPaid;
  const commissionEarned = deal.totalAmount * (deal.commissionPct / 100);
  const commissionOwed = commissionEarned - deal.commissionPaid;
  const paymentProgress = payments.length > 0
    ? payments.filter((p) => p.verified).length / payments.length
    : 0;
  const callCount = calls.filter((c) => c.dealId === deal.id).length;

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl border border-border p-3.5 cursor-pointer hover:shadow-md hover:border-border/80 transition-all group"
    >
      {/* Client name + amount */}
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-sm font-semibold leading-tight">{deal.clientName}</h3>
        <span className="text-sm font-bold ml-2 shrink-0">{formatCurrency(deal.totalAmount)}</span>
      </div>

      {/* Product */}
      <p className="text-[11px] text-muted-foreground mb-2.5">
        {deal.product}
      </p>

      {/* Payment progress bar */}
      {payments.length > 0 && (
        <div className="mb-2.5">
          <div className="flex items-center justify-between text-[10px] mb-1">
            <span className="text-muted-foreground">
              {totalPaid > 0 ? `${formatCurrency(totalPaid)} paid` : "No payments yet"}
            </span>
            {totalOwed > 0 && (
              <span className="font-medium text-amber-600">{formatCurrency(totalOwed)} left</span>
            )}
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                paymentProgress === 1 ? "bg-emerald-500" : paymentProgress > 0 ? "bg-blue-500" : "bg-gray-200"
              )}
              style={{ width: `${paymentProgress * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Bottom row: rep + commission + calls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-[9px] font-semibold">
            {salesperson?.name?.charAt(0) || "?"}
          </div>
          <span className="text-[11px] text-muted-foreground">{salesperson?.name || "Unassigned"}</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          {callCount > 0 && (
            <span className="flex items-center gap-0.5">
              <Phone className="h-3 w-3" />
              {callCount}
            </span>
          )}
          {commissionOwed > 0 && (
            <span className="flex items-center gap-0.5 text-emerald-600 font-medium">
              {formatCurrency(commissionOwed)}
            </span>
          )}
          {deal.commissionPaid > 0 && (
            <span className="flex items-center gap-0.5 text-muted-foreground">
              <Check className="h-3 w-3" />
              {formatCurrency(deal.commissionPaid)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
