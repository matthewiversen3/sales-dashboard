"use client";

import { useStore } from "@/lib/hooks";
import { StatsCard } from "@/components/stats-card";
import { formatCurrency } from "@/lib/format";
import { DollarSign, HandCoins, Wallet, AlertTriangle, Users, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PIPELINE_STAGES } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function OverviewPage() {
  const { deals, payments, salespeople, loaded } = useStore();

  if (!loaded) return <div className="animate-pulse h-96" />;

  const totalRevenue = deals.reduce((sum, d) => sum + d.totalAmount, 0);
  const totalCommissions = deals.reduce((sum, d) => sum + d.totalAmount * (d.commissionPct / 100), 0);
  const totalCommissionPaid = deals.reduce((sum, d) => sum + d.commissionPaid, 0);
  const collectedPayments = payments.filter((p) => p.verified);
  const totalCollected = collectedPayments.reduce((sum, p) => sum + p.amount, 0);
  const outstandingPayments = payments.filter((p) => !p.verified);
  const totalOutstanding = outstandingPayments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground mt-1">Revenue, commissions, and pipeline summary</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatsCard title="Total Pipeline" value={formatCurrency(totalRevenue)} subtitle={`${deals.length} deals`} icon={DollarSign} />
        <StatsCard title="Collected" value={formatCurrency(totalCollected)} subtitle={`${collectedPayments.length} payments`} icon={Wallet} trend="up" />
        <StatsCard title="Outstanding" value={formatCurrency(totalOutstanding)} subtitle={`${outstandingPayments.length} pending`} icon={HandCoins} />
        <StatsCard title="Commissions Earned" value={formatCurrency(totalCommissions)} subtitle="Total owed to reps" icon={TrendingUp} />
        <StatsCard title="Commissions Paid" value={formatCurrency(totalCommissionPaid)} subtitle={formatCurrency(totalCommissions - totalCommissionPaid) + " remaining"} icon={Wallet} trend="up" />
        <StatsCard title="Team" value={salespeople.length.toString()} subtitle={`${salespeople.filter(s => s.role === "rep").length} reps + founder`} icon={Users} />
      </div>

      {/* Pipeline breakdown */}
      <Card className="border shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Pipeline Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {PIPELINE_STAGES.map((stage) => {
              const stageDeals = deals.filter((d) => d.stage === stage.key);
              const stageTotal = stageDeals.reduce((s, d) => s + d.totalAmount, 0);
              const pct = totalRevenue > 0 ? (stageTotal / totalRevenue) * 100 : 0;
              return (
                <div key={stage.key} className="flex items-center gap-3">
                  <span className="text-xs font-medium w-20 shrink-0 uppercase tracking-wider">{stage.label}</span>
                  <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all", stage.color.includes("blue") ? "bg-blue-400" : stage.color.includes("purple") ? "bg-purple-400" : stage.color.includes("amber") ? "bg-amber-400" : stage.color.includes("orange") ? "bg-orange-400" : "bg-emerald-400")} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="text-right shrink-0 w-28">
                    <span className="text-xs font-semibold">{formatCurrency(stageTotal)}</span>
                    <span className="text-[10px] text-muted-foreground ml-1">({stageDeals.length})</span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Per-rep breakdown */}
      <Card className="border shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Rep Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {salespeople.map((sp) => {
              const spDeals = deals.filter((d) => d.salespersonId === sp.id);
              const spRevenue = spDeals.reduce((s, d) => s + d.totalAmount, 0);
              const spCommission = spDeals.reduce((s, d) => s + d.totalAmount * (d.commissionPct / 100), 0);
              const spPaid = spDeals.reduce((s, d) => s + d.commissionPaid, 0);
              const spCollected = payments.filter((p) => spDeals.some((d) => d.id === p.dealId) && p.verified).reduce((s, p) => s + p.amount, 0);

              return (
                <div key={sp.id} className="flex items-center gap-4 py-2 border-b border-border last:border-0">
                  <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-semibold shrink-0">
                    {sp.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{sp.name} {sp.role === "founder" && <span className="text-[10px] text-muted-foreground">(Founder)</span>}</p>
                    <p className="text-xs text-muted-foreground">{spDeals.length} deals &middot; {formatCurrency(spRevenue)} pipeline</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold">{formatCurrency(spCollected)}</p>
                    <p className="text-[10px] text-muted-foreground">collected</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-emerald-600">{formatCurrency(spPaid)}</p>
                    <p className="text-[10px] text-muted-foreground">comm. paid</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-amber-600">{formatCurrency(spCommission - spPaid)}</p>
                    <p className="text-[10px] text-muted-foreground">comm. owed</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
