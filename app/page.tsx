"use client";

import { useStore } from "@/lib/hooks";
import { DealCard } from "@/components/deal-card";
import { FilterChips } from "@/components/filter-chips";
import { PIPELINE_STAGES, PipelineStage, PRODUCTS, PAYMENT_TYPES, LEAD_SOURCES, Product, PaymentType, LeadSource } from "@/lib/types";
import {
  addDeal,
  generatePaymentSchedule,
  generateReminders,
  moveDeal,
  updateDeal,
  deleteDeal,
  verifyPayment,
  unverifyPayment,
  payCommission,
} from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatCurrency, formatDate, daysUntil, getPaymentStatus } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  Plus,
  Trash2,
  Check,
  Undo2,
  Phone,
  X,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { useState } from "react";
import { Deal } from "@/lib/types";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import { useDroppable, useDraggable } from "@dnd-kit/core";

function DroppableColumn({ id, children }: { id: string; children: React.ReactNode }) {
  const { isOver, setNodeRef } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={cn("flex-1 overflow-y-auto p-2.5 space-y-2 transition-colors rounded-b-2xl", isOver && "bg-primary/5")}>
      {children}
    </div>
  );
}

function DraggableDealCard({ deal, salesperson, payments: dealPayments, calls: dealCalls, onClick }: {
  deal: Deal;
  salesperson?: import("@/lib/types").Salesperson;
  payments: import("@/lib/types").Payment[];
  calls: import("@/lib/types").SalesCall[];
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: deal.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} className={cn(isDragging && "opacity-30")}>
      <DealCard deal={deal} salesperson={salesperson} payments={dealPayments} calls={dealCalls} onClick={onClick} />
    </div>
  );
}

export default function BoardPage() {
  const { deals, salespeople, payments, calls, refresh, loaded } = useStore();
  const [filterSp, setFilterSp] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [detailDeal, setDetailDeal] = useState<string | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveDragId(event.active.id as string);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveDragId(null);
    if (!over) return;

    const dealId = active.id as string;
    const newStage = over.id as PipelineStage;
    const deal = deals.find((d) => d.id === dealId);
    if (!deal || deal.stage === newStage) return;

    await moveDeal(dealId, newStage);

    // Auto-generate payments when moving to "closed" or later if none exist
    const dealPayments = payments.filter((p) => p.dealId === dealId);
    if ((newStage === "closed" || newStage === "collecting") && dealPayments.length === 0 && deal.totalAmount > 0) {
      const pmts = await generatePaymentSchedule({ ...deal, stage: newStage });
      await generateReminders({ ...deal, stage: newStage }, pmts);
    }

    await refresh();
  }

  // Add deal form
  const [clientName, setClientName] = useState("");
  const [salespersonId, setSalespersonId] = useState("");
  const [product, setProduct] = useState<Product>("DFY Custom App Build");
  const [paymentType, setPaymentType] = useState<PaymentType>("PIF");
  const [totalAmount, setTotalAmount] = useState("");
  const [commissionPct, setCommissionPct] = useState("10");
  const [closeDate, setCloseDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [addStage, setAddStage] = useState<PipelineStage>("lead");
  const [leadSource, setLeadSource] = useState<LeadSource>("Meta Ads");
  const [setterId, setSetterId] = useState<string>("");

  if (!loaded) return <div className="animate-pulse h-96" />;

  const spOptions = [
    { value: "all", label: "All" },
    ...salespeople.map((sp) => ({ value: sp.id, label: sp.name })),
  ];

  const filteredDeals = filterSp === "all" ? deals : deals.filter((d) => d.salespersonId === filterSp);

  function resetForm() {
    setClientName("");
    setSalespersonId("");
    setProduct("DFY Custom App Build");
    setPaymentType("PIF");
    setTotalAmount("");
    setCommissionPct("10");
    setCloseDate(new Date().toISOString().split("T")[0]);
    setNotes("");
    setAddStage("lead");
    setLeadSource("Meta Ads");
    setSetterId("");
  }

  async function handleAddDeal(e: React.FormEvent) {
    e.preventDefault();
    if (!clientName.trim() || !salespersonId) return;

    const deal = await addDeal({
      clientName,
      salespersonId,
      product,
      paymentType,
      totalAmount: parseFloat(totalAmount) || 0,
      commissionPct: parseFloat(commissionPct) || 10,
      commissionPaid: 0,
      closeDate,
      stage: addStage,
      leadSource,
      setterId: setterId || null,
      notes,
      callIds: [],
    });

    if (addStage !== "lead" && addStage !== "proposal" && parseFloat(totalAmount) > 0) {
      const pmts = await generatePaymentSchedule(deal);
      await generateReminders(deal, pmts);
    }

    resetForm();
    setAddOpen(false);
    await refresh();
  }

  async function handleMoveStage(dealId: string, direction: "left" | "right") {
    const deal = deals.find((d) => d.id === dealId);
    if (!deal) return;
    const stageKeys = PIPELINE_STAGES.map((s) => s.key);
    const idx = stageKeys.indexOf(deal.stage);
    const newIdx = direction === "right" ? idx + 1 : idx - 1;
    if (newIdx < 0 || newIdx >= stageKeys.length) return;

    const newStage = stageKeys[newIdx];
    await moveDeal(dealId, newStage);

    // Auto-generate payments when moving to "closed" or later if none exist
    const dealPayments = payments.filter((p) => p.dealId === dealId);
    if ((newStage === "closed" || newStage === "collecting") && dealPayments.length === 0 && deal.totalAmount > 0) {
      const pmts = await generatePaymentSchedule({ ...deal, stage: newStage });
      await generateReminders({ ...deal, stage: newStage }, pmts);
    }

    await refresh();
  }

  async function handleDeleteDeal(dealId: string) {
    await deleteDeal(dealId);
    setDetailDeal(null);
    await refresh();
  }

  // Detail panel
  const selectedDeal = detailDeal ? deals.find((d) => d.id === detailDeal) : null;
  const selectedSp = selectedDeal ? salespeople.find((s) => s.id === selectedDeal.salespersonId) : null;
  const selectedPayments = selectedDeal ? payments.filter((p) => p.dealId === selectedDeal.id).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()) : [];
  const selectedCalls = selectedDeal ? calls.filter((c) => c.dealId === selectedDeal.id) : [];
  const selectedTotalPaid = selectedPayments.filter((p) => p.verified).reduce((s, p) => s + p.amount, 0);
  const selectedCommissionEarned = selectedDeal ? selectedDeal.totalAmount * (selectedDeal.commissionPct / 100) : 0;

  return (
    <div className="h-[calc(100vh-3rem)] md:h-[calc(100vh-3rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Pipeline</h1>
          <div className="mt-2">
            <FilterChips options={spOptions} value={filterSp} onChange={setFilterSp} />
          </div>
        </div>
        <Dialog open={addOpen} onOpenChange={(v) => { setAddOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger render={<Button size="sm" className="gap-1.5 shrink-0" />}>
            <Plus className="h-4 w-4" />
            Add Deal
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Deal</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddDeal} className="space-y-3 mt-1">
              <div className="space-y-1.5">
                <Label className="text-xs">Client Name</Label>
                <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Client name" required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Salesperson</Label>
                <div className="flex gap-1.5">
                  {salespeople.map((sp) => (
                    <button type="button" key={sp.id} onClick={() => setSalespersonId(sp.id)}
                      className={cn("px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                        salespersonId === sp.id ? "bg-primary text-primary-foreground border-primary" : "bg-white text-muted-foreground border-border hover:border-foreground/20"
                      )}>{sp.name}</button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Product</Label>
                <div className="flex gap-1.5">
                  {PRODUCTS.map((p) => (
                    <button type="button" key={p} onClick={() => setProduct(p)}
                      className={cn("px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                        product === p ? "bg-primary text-primary-foreground border-primary" : "bg-white text-muted-foreground border-border hover:border-foreground/20"
                      )}>{p.replace("Custom App Build", "").trim()}</button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Stage</Label>
                <div className="flex gap-1.5 flex-wrap">
                  {PIPELINE_STAGES.map((s) => (
                    <button type="button" key={s.key} onClick={() => setAddStage(s.key)}
                      className={cn("px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                        addStage === s.key ? "bg-primary text-primary-foreground border-primary" : "bg-white text-muted-foreground border-border hover:border-foreground/20"
                      )}>{s.label}</button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Amount</Label>
                  <Input type="number" step="0.01" min="0" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} placeholder="10000" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Commission %</Label>
                  <Input type="number" step="0.5" min="0" max="100" value={commissionPct} onChange={(e) => setCommissionPct(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Close Date</Label>
                  <Input type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Lead Source</Label>
                <div className="flex gap-1.5 flex-wrap">
                  {LEAD_SOURCES.map((ls) => (
                    <button type="button" key={ls} onClick={() => setLeadSource(ls)}
                      className={cn("px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-colors",
                        leadSource === ls ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:border-foreground/20"
                      )}>{ls}</button>
                  ))}
                </div>
              </div>
              {salespeople.some((sp) => sp.role === "setter") && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Set by</Label>
                  <div className="flex gap-1.5">
                    <button type="button" onClick={() => setSetterId("")}
                      className={cn("px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-colors",
                        !setterId ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:border-foreground/20"
                      )}>None</button>
                    {salespeople.filter((sp) => sp.role === "setter").map((sp) => (
                      <button type="button" key={sp.id} onClick={() => setSetterId(sp.id)}
                        className={cn("px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-colors",
                          setterId === sp.id ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:border-foreground/20"
                        )}>{sp.name}</button>
                    ))}
                  </div>
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs">Notes</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes about this deal..." rows={2} />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outline" size="sm" onClick={() => { setAddOpen(false); resetForm(); }}>Cancel</Button>
                <Button type="submit" size="sm" disabled={!salespersonId || !clientName}>Create Deal</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Kanban Board */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex-1 overflow-x-auto overflow-y-hidden">
          <div className="flex gap-4 h-full min-w-max pb-4">
            {PIPELINE_STAGES.map((stage) => {
              const stageDeals = filteredDeals
                .filter((d) => d.stage === stage.key)
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
              const stageTotal = stageDeals.reduce((s, d) => s + d.totalAmount, 0);

              return (
                <div key={stage.key} className={cn("w-72 shrink-0 flex flex-col rounded-2xl border", stage.color, stage.darkColor)}>
                  {/* Column header */}
                  <div className="px-3.5 py-3 border-b border-inherit">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h2 className="text-[11px] font-semibold uppercase tracking-widest">{stage.label}</h2>
                        <span className="text-[10px] bg-background/60 dark:bg-white/10 px-1.5 py-0.5 rounded-full font-medium tabular-nums">{stageDeals.length}</span>
                      </div>
                      <span className="text-[10px] font-medium text-muted-foreground tabular-nums">{formatCurrency(stageTotal)}</span>
                    </div>
                  </div>

                  {/* Cards */}
                  <DroppableColumn id={stage.key}>
                    {stageDeals.map((deal) => {
                      const sp = salespeople.find((s) => s.id === deal.salespersonId);
                      const dealPayments = payments.filter((p) => p.dealId === deal.id);
                      return (
                        <DraggableDealCard
                          key={deal.id}
                          deal={deal}
                          salesperson={sp}
                          payments={dealPayments}
                          calls={calls}
                          onClick={() => setDetailDeal(deal.id)}
                        />
                      );
                    })}
                    {stageDeals.length === 0 && (
                      <div className="text-center py-8 text-xs text-muted-foreground">
                        No deals
                      </div>
                    )}
                  </DroppableColumn>
                </div>
              );
            })}
          </div>
        </div>

        {/* Drag overlay */}
        <DragOverlay>
          {activeDragId ? (() => {
            const deal = deals.find((d) => d.id === activeDragId);
            if (!deal) return null;
            const sp = salespeople.find((s) => s.id === deal.salespersonId);
            const dealPayments = payments.filter((p) => p.dealId === deal.id);
            return (
              <div className="w-72 rotate-2 opacity-90">
                <DealCard deal={deal} salesperson={sp} payments={dealPayments} calls={calls} onClick={() => {}} />
              </div>
            );
          })() : null}
        </DragOverlay>
      </DndContext>

      {/* Deal Detail Panel (slide-over) */}
      {selectedDeal && (
        <>
          <div className="fixed inset-0 bg-black/20 dark:bg-black/40 backdrop-blur-[2px] z-40" onClick={() => setDetailDeal(null)} />
          <div className="fixed right-0 top-0 z-50 h-full w-full max-w-md bg-card border-l border-border shadow-2xl overflow-y-auto">
            <div className="sticky top-0 bg-card/95 backdrop-blur-sm border-b border-border px-5 py-3.5 flex items-center justify-between z-10">
              <h2 className="text-sm font-semibold tracking-[-0.01em]">{selectedDeal.clientName}</h2>
              <div className="flex items-center gap-1">
                <button onClick={() => handleDeleteDeal(selectedDeal.id)} className="p-1.5 rounded-md hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
                <button onClick={() => setDetailDeal(null)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-5">
              {/* Stage controls */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => handleMoveStage(selectedDeal.id, "left")}
                  disabled={selectedDeal.stage === "lead"}
                  className="p-1.5 rounded-md hover:bg-muted disabled:opacity-30 text-muted-foreground transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="flex gap-1">
                  {PIPELINE_STAGES.map((s) => (
                    <button
                      key={s.key}
                      onClick={async () => { await moveDeal(selectedDeal.id, s.key); await refresh(); }}
                      className={cn(
                        "px-2.5 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider transition-colors border",
                        selectedDeal.stage === s.key ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground border-border hover:bg-muted"
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => handleMoveStage(selectedDeal.id, "right")}
                  disabled={selectedDeal.stage === "paid"}
                  className="p-1.5 rounded-md hover:bg-muted disabled:opacity-30 text-muted-foreground transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              {/* Key info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Deal Value</p>
                  <p className="text-lg font-bold">{formatCurrency(selectedDeal.totalAmount)}</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Collected</p>
                  <p className="text-lg font-bold text-emerald-600">{formatCurrency(selectedTotalPaid)}</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Commission</p>
                  <p className="text-lg font-bold">{formatCurrency(selectedCommissionEarned)}</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Commission Paid</p>
                  <p className="text-lg font-bold text-emerald-600">{formatCurrency(selectedDeal.commissionPaid)}</p>
                  {selectedCommissionEarned - selectedDeal.commissionPaid > 0 && (
                    <p className="text-[10px] text-amber-600 mt-0.5">
                      {formatCurrency(selectedCommissionEarned - selectedDeal.commissionPaid)} owed
                    </p>
                  )}
                </div>
              </div>

              {/* Details */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-1.5 border-b border-border">
                  <span className="text-muted-foreground">Product</span>
                  <span className="font-medium">{selectedDeal.product}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border">
                  <span className="text-muted-foreground">Payment Type</span>
                  <span className="font-medium">{selectedDeal.paymentType}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border">
                  <span className="text-muted-foreground">Rep</span>
                  <span className="font-medium">{selectedSp?.name}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border">
                  <span className="text-muted-foreground">Close Date</span>
                  <span className="font-medium">{formatDate(selectedDeal.closeDate)}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border">
                  <span className="text-muted-foreground">Lead Source</span>
                  <span className="font-medium">{selectedDeal.leadSource || "—"}</span>
                </div>
                {(() => {
                  const setter = selectedDeal.setterId ? salespeople.find((s) => s.id === selectedDeal.setterId) : null;
                  return setter ? (
                    <div className="flex justify-between py-1.5 border-b border-border">
                      <span className="text-muted-foreground">Set by</span>
                      <span className="font-medium">{setter.name}</span>
                    </div>
                  ) : null;
                })()}
              </div>

              {/* Notes */}
              {selectedDeal.notes && (
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Notes</p>
                  <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">{selectedDeal.notes}</p>
                </div>
              )}

              {/* Payments */}
              {selectedPayments.length > 0 && (
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Payments</p>
                  <div className="space-y-1.5">
                    {selectedPayments.map((payment) => {
                      const status = getPaymentStatus(payment.dueDate, payment.verified);
                      const days = daysUntil(payment.dueDate);
                      return (
                        <div key={payment.id} className={cn(
                          "flex items-center justify-between rounded-lg border px-3 py-2 text-sm",
                          status === "collected" && "border-emerald-200 bg-emerald-50/50",
                          status === "overdue" && "border-red-200 bg-red-50/50",
                          status === "due-soon" && "border-amber-200 bg-amber-50/50",
                          status === "upcoming" && "border-border"
                        )}>
                          <div className="flex items-center gap-2">
                            {payment.verified ? (
                              <div className="h-5 w-5 rounded-full bg-emerald-500 flex items-center justify-center">
                                <Check className="h-3 w-3 text-white" />
                              </div>
                            ) : (
                              <div className={cn("h-5 w-5 rounded-full border-2",
                                status === "overdue" ? "border-red-300" : status === "due-soon" ? "border-amber-300" : "border-muted-foreground/30"
                              )} />
                            )}
                            <div>
                              <p className="text-xs font-medium">{payment.monthLabel}</p>
                              <p className="text-[10px] text-muted-foreground">Due {formatDate(payment.dueDate)}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold">{formatCurrency(payment.amount)}</span>
                            {payment.verified ? (
                              <button onClick={async () => { await unverifyPayment(payment.id); await refresh(); }} className="text-[10px] text-muted-foreground hover:text-foreground">
                                <Undo2 className="h-3 w-3" />
                              </button>
                            ) : (
                              <Button size="sm" className="h-6 text-[10px] px-2" onClick={async () => { await verifyPayment(payment.id); await refresh(); }}>
                                <Check className="h-3 w-3 mr-0.5" />
                                Verify
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Calls */}
              {selectedCalls.length > 0 && (
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Calls</p>
                  <div className="space-y-1.5">
                    {selectedCalls.map((call) => (
                      <div key={call.id} className="rounded-lg border border-border p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs font-medium">{call.title}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mb-1">
                          {formatDate(call.date)} &middot; {call.duration}min &middot; {call.participants.join(", ")}
                        </p>
                        {call.summary && (
                          <p className="text-xs text-muted-foreground bg-muted/50 rounded p-2 mt-1.5">{call.summary}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
