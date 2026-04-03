"use client";

import { Deal, Payment, Salesperson, SalesCall } from "@/lib/types";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Check, Phone } from "lucide-react";

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
      className="bg-card rounded-2xl border border-border/60 p-4 cursor-pointer hover:border-border hover:shadow-sm transition-all duration-150 group"
    >
      {/* Client name + amount */}
      <div className="flex items-start justify-between mb-1.5">
        <h3 className="text-[13px] font-semibold leading-tight tracking-[-0.01em]">{deal.clientName}</h3>
        <span className="text-[13px] font-bold ml-2 shrink-0 tabular-nums">{formatCurrency(deal.totalAmount)}</span>
      </div>

      {/* Product + lead source */}
      <div className="flex items-center gap-1.5 mb-3">
        <span className="text-[11px] text-muted-foreground">{deal.product}</span>
        {deal.leadSource && deal.leadSource !== "Other" && (
          <>
            <span className="text-muted-foreground/40">·</span>
            <span className="text-[10px] text-muted-foreground/80">{deal.leadSource}</span>
          </>
        )}
      </div>

      {/* Payment progress bar */}
      {payments.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-[10px] mb-1.5">
            <span className="text-muted-foreground">
              {totalPaid > 0 ? `${formatCurrency(totalPaid)} paid` : "No payments yet"}
            </span>
            {totalOwed > 0 && (
              <span className="font-medium text-amber-500 dark:text-amber-400">{formatCurrency(totalOwed)} left</span>
            )}
          </div>
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                paymentProgress === 1 ? "bg-emerald-500" : paymentProgress > 0 ? "bg-blue-500" : "bg-muted-foreground/20"
              )}
              style={{ width: `${paymentProgress * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Bottom row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="h-5 w-5 rounded-full bg-muted-foreground/15 flex items-center justify-center text-foreground/70 text-[9px] font-semibold">
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
            <span className="flex items-center gap-0.5 text-emerald-500 dark:text-emerald-400 font-medium">
              {formatCurrency(commissionOwed)}
            </span>
          )}
          {deal.commissionPaid > 0 && (
            <span className="flex items-center gap-0.5 text-muted-foreground/60">
              <Check className="h-3 w-3" />
              {formatCurrency(deal.commissionPaid)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
