"use client";

import { useStore } from "@/lib/hooks";
import { verifyPayment, unverifyPayment } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FilterChips } from "@/components/filter-chips";
import { Check, Wallet, Undo2 } from "lucide-react";
import { useState } from "react";
import {
  formatCurrency,
  formatDate,
  daysUntil,
  getPaymentStatus,
} from "@/lib/format";
import { cn } from "@/lib/utils";

export default function CollectionsPage() {
  const { deals, salespeople, payments, refresh, loaded } = useStore();
  const [filterSp, setFilterSp] = useState<string>("all");
  const [showVerified, setShowVerified] = useState(false);

  if (!loaded) return <div className="animate-pulse h-96" />;

  function handleVerify(paymentId: string) {
    verifyPayment(paymentId);
    refresh();
  }

  function handleUnverify(paymentId: string) {
    unverifyPayment(paymentId);
    refresh();
  }

  // Build enriched payment list
  const enrichedPayments = payments
    .map((p) => {
      const deal = deals.find((d) => d.id === p.dealId);
      const sp = deal
        ? salespeople.find((s) => s.id === deal.salespersonId)
        : null;
      return { ...p, deal, salesperson: sp };
    })
    .filter((p) => {
      if (!showVerified && p.verified) return false;
      if (filterSp !== "all" && p.salesperson?.id !== filterSp) return false;
      return true;
    })
    .sort((a, b) => {
      // Overdue first, then by due date
      if (a.verified !== b.verified) return a.verified ? 1 : -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });

  // Group by salesperson
  const grouped = new Map<
    string,
    typeof enrichedPayments
  >();
  for (const p of enrichedPayments) {
    const key = p.salesperson?.id || "unknown";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(p);
  }

  const totalOutstanding = enrichedPayments
    .filter((p) => !p.verified)
    .reduce((sum, p) => sum + p.amount, 0);
  const overdueCount = enrichedPayments.filter(
    (p) => !p.verified && daysUntil(p.dueDate) < 0
  ).length;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Collections</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {formatCurrency(totalOutstanding)} outstanding
            {overdueCount > 0 && (
              <span className="text-red-500 ml-1">
                &middot; {overdueCount} overdue
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <FilterChips
          options={[
            { value: "all", label: "All Reps" },
            ...salespeople.map((sp) => ({
              value: sp.id,
              label: sp.name.split(" ")[0],
            })),
          ]}
          value={filterSp}
          onChange={setFilterSp}
        />
        <Button
          variant={showVerified ? "default" : "outline"}
          size="sm"
          onClick={() => setShowVerified(!showVerified)}
          className="text-xs gap-1.5"
        >
          <Check className="h-3 w-3" />
          {showVerified ? "Showing verified" : "Show verified"}
        </Button>
      </div>

      {/* Payment groups */}
      {enrichedPayments.length === 0 ? (
        <Card className="border shadow-none">
          <CardContent className="py-12 text-center">
            <Wallet className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {payments.length === 0
                ? "No payments yet. Create a deal to generate payments."
                : "All payments are collected!"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Array.from(grouped.entries()).map(([spId, spPayments]) => {
            const sp = salespeople.find((s) => s.id === spId);
            const spOutstanding = spPayments
              .filter((p) => !p.verified)
              .reduce((sum, p) => sum + p.amount, 0);

            return (
              <Card key={spId} className="border shadow-none">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-medium">
                        {sp
                          ? sp.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .toUpperCase()
                              .slice(0, 2)
                          : "?"}
                      </div>
                      <CardTitle className="text-sm font-medium">
                        {sp?.name || "Unknown"}
                      </CardTitle>
                    </div>
                    <p className="text-sm font-semibold">
                      {formatCurrency(spOutstanding)}{" "}
                      <span className="text-muted-foreground font-normal">
                        outstanding
                      </span>
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="pt-2">
                  <div className="space-y-2">
                    {spPayments.map((payment) => {
                      const status = getPaymentStatus(
                        payment.dueDate,
                        payment.verified
                      );
                      const days = daysUntil(payment.dueDate);

                      return (
                        <div
                          key={payment.id}
                          className={cn(
                            "flex items-center justify-between rounded-lg border px-4 py-3 transition-colors",
                            status === "collected" &&
                              "border-emerald-200 bg-emerald-50/50 opacity-60",
                            status === "overdue" &&
                              "border-red-200 bg-red-50/50",
                            status === "due-soon" &&
                              "border-amber-200 bg-amber-50/50",
                            status === "upcoming" && "border-border"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            {payment.verified ? (
                              <div className="h-6 w-6 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                                <Check className="h-3.5 w-3.5 text-white" />
                              </div>
                            ) : (
                              <div
                                className={cn(
                                  "h-6 w-6 rounded-full border-2 shrink-0",
                                  status === "overdue"
                                    ? "border-red-300"
                                    : status === "due-soon"
                                    ? "border-amber-300"
                                    : "border-muted-foreground/30"
                                )}
                              />
                            )}
                            <div>
                              <p className="text-sm font-medium">
                                {payment.deal?.clientName || "Unknown"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {payment.monthLabel} &middot;{" "}
                                {payment.deal?.paymentType} &middot; Due{" "}
                                {formatDate(payment.dueDate)}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="text-sm font-semibold">
                                {formatCurrency(payment.amount)}
                              </p>
                              {!payment.verified && (
                                <span
                                  className={cn(
                                    "text-[10px] font-medium",
                                    status === "overdue" && "text-red-600",
                                    status === "due-soon" && "text-amber-600",
                                    status === "upcoming" && "text-gray-400"
                                  )}
                                >
                                  {status === "overdue"
                                    ? `${Math.abs(days)}d overdue`
                                    : status === "due-soon"
                                    ? `${days}d left`
                                    : `in ${days}d`}
                                </span>
                              )}
                            </div>

                            {payment.verified ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs gap-1 text-muted-foreground"
                                onClick={() => handleUnverify(payment.id)}
                              >
                                <Undo2 className="h-3 w-3" />
                                Undo
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                className="h-8 text-xs gap-1"
                                onClick={() => handleVerify(payment.id)}
                              >
                                <Check className="h-3 w-3" />
                                Verify
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
