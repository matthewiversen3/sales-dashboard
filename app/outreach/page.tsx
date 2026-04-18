"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  MessageSquare,
  Flame,
  Thermometer,
  Snowflake,
  CheckCircle2,
  SkipForward,
  Edit3,
  Copy,
  Send,
  RefreshCw,
  Loader2,
  Zap,
  ExternalLink,
  Clock,
  Phone,
  AlertCircle,
} from "lucide-react";

interface OutreachLead {
  id: string;
  contact_name: string;
  phone: string | null;
  temperature: "hot" | "warm" | "cold";
  pipeline_stage: string | null;
  draft_message: string;
  edited_message: string | null;
  last_message: string | null;
  last_sender: string | null;
  last_contact_date: string | null;
  days_since: number | null;
  status: "pending_review" | "approved" | "sent" | "skipped";
  assigned_to: string | null;
  ghl_contact_id: string | null;
  source: string;
  sent_at: string | null;
  created_at: string;
}

const TEMP_CONFIG = {
  hot: { label: "Hot", icon: Flame, color: "text-red-500", bg: "bg-red-500/10", badge: "bg-red-900/40 text-red-300" },
  warm: { label: "Warm", icon: Thermometer, color: "text-amber-500", bg: "bg-amber-500/10", badge: "bg-amber-900/40 text-amber-300" },
  cold: { label: "Cold", icon: Snowflake, color: "text-blue-400", bg: "bg-blue-500/10", badge: "bg-blue-900/40 text-blue-300" },
};

type FilterType = "all" | "hot" | "warm" | "cold" | "pending_review" | "approved" | "sent" | "skipped";

export default function OutreachPage() {
  const [leads, setLeads] = useState<OutreachLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type?: string } | null>(null);

  const showToast = (msg: string, type = "") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/outreach");
      const data = await res.json();
      setLeads(data.leads || []);
    } catch {
      console.error("Failed to fetch leads");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  async function updateLead(id: string, updates: Partial<OutreachLead>) {
    await fetch("/api/outreach", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...updates }),
    });
    setLeads(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
  }

  async function sendViaGHL(lead: OutreachLead) {
    if (!lead.ghl_contact_id) {
      showToast("⚠️ No GHL contact ID — use iMessage instead", "warn");
      return;
    }
    setSendingId(lead.id);
    try {
      const msg = lead.edited_message || lead.draft_message;
      const res = await fetch("/api/outreach/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: lead.id, message: msg }),
      });
      const data = await res.json();
      if (data.ok) {
        await updateLead(lead.id, { status: "sent", sent_at: new Date().toISOString() });
        showToast("📤 Sent via GHL!", "success");
      } else {
        showToast("❌ Send failed: " + data.error, "error");
      }
    } catch {
      showToast("❌ Send failed", "error");
    } finally {
      setSendingId(null);
    }
  }

  function copyMessage(lead: OutreachLead) {
    const msg = lead.edited_message || lead.draft_message;
    navigator.clipboard.writeText(msg);
    showToast("📋 Copied!", "success");
  }

  function openIMessage(lead: OutreachLead) {
    if (!lead.phone) return;
    const msg = lead.edited_message || lead.draft_message;
    const phone = lead.phone.replace(/\D/g, "");
    window.open(`sms:+${phone}?&body=${encodeURIComponent(msg)}`);
    updateLead(lead.id, { status: "approved" });
  }

  function startEdit(lead: OutreachLead) {
    setEditingId(lead.id);
    setEditText(lead.edited_message || lead.draft_message);
  }

  async function saveEdit(id: string) {
    await updateLead(id, { edited_message: editText });
    setEditingId(null);
    showToast("✏️ Message updated", "success");
  }

  const filtered = leads.filter(l => {
    const matchFilter =
      filter === "all" ? true :
      filter === "hot" ? l.temperature === "hot" :
      filter === "warm" ? l.temperature === "warm" :
      filter === "cold" ? l.temperature === "cold" :
      l.status === filter;
    const matchSearch = !search ||
      l.contact_name.toLowerCase().includes(search.toLowerCase()) ||
      (l.phone || "").includes(search);
    return matchFilter && matchSearch;
  });

  const stats = {
    total: leads.length,
    hot: leads.filter(l => l.temperature === "hot").length,
    pending: leads.filter(l => l.status === "pending_review").length,
    approved: leads.filter(l => l.status === "approved").length,
    sent: leads.filter(l => l.status === "sent").length,
    skipped: leads.filter(l => l.status === "skipped").length,
  };

  const filterTabs: { key: FilterType; label: string; count?: number }[] = [
    { key: "all", label: "All", count: stats.total },
    { key: "hot", label: "🔥 Hot", count: stats.hot },
    { key: "warm", label: "🌤 Warm" },
    { key: "cold", label: "❄️ Cold" },
    { key: "pending_review", label: "Pending", count: stats.pending },
    { key: "approved", label: "Approved", count: stats.approved },
    { key: "sent", label: "Sent", count: stats.sent },
    { key: "skipped", label: "Skipped" },
  ];

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">AI Outreach</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Review, approve, and send AI-drafted follow-up messages
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchLeads} disabled={loading} className="gap-1.5">
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: "Total Leads", val: stats.total, color: "" },
          { label: "🔥 Hot", val: stats.hot, color: "text-red-500" },
          { label: "Pending", val: stats.pending, color: "text-amber-500" },
          { label: "Sent", val: stats.sent, color: "text-emerald-500" },
          { label: "Skipped", val: stats.skipped, color: "text-muted-foreground" },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4">
            <div className={cn("text-2xl font-bold", s.color)}>{s.val}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-emerald-500 to-indigo-500 rounded-full transition-all duration-500"
          style={{ width: stats.total ? `${((stats.sent + stats.skipped) / stats.total) * 100}%` : "0%" }}
        />
      </div>

      {/* Filter tabs + search */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1 bg-muted/50 rounded-xl p-1 w-fit">
          {filterTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1",
                filter === tab.key
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded-full",
                  filter === tab.key ? "bg-muted" : "bg-muted/50"
                )}>{tab.count}</span>
              )}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="Search by name or phone..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="bg-card border border-border rounded-xl px-3 py-2 text-sm w-full max-w-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Lead list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-sm text-muted-foreground">
          {leads.length === 0
            ? "No leads yet. They'll appear here when new contacts come in from GHL or are imported."
            : `No leads match current filter.`}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(lead => {
            const tempCfg = TEMP_CONFIG[lead.temperature] || TEMP_CONFIG.cold;
            const TempIcon = tempCfg.icon;
            const isEditing = editingId === lead.id;
            const isSending = sendingId === lead.id;
            const msg = lead.edited_message || lead.draft_message;
            const isOverdue = lead.days_since !== null && lead.days_since > 14 && lead.temperature === "hot";

            return (
              <div
                key={lead.id}
                className={cn(
                  "bg-card border border-border rounded-xl p-5 transition-all",
                  lead.status === "sent" && "opacity-60 border-emerald-800/40",
                  lead.status === "skipped" && "opacity-40",
                  lead.status === "approved" && "border-l-2 border-l-emerald-500"
                )}
              >
                {/* Top row */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{lead.contact_name}</span>
                      <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", tempCfg.badge)}>
                        {lead.temperature.toUpperCase()}
                      </span>
                      {lead.pipeline_stage && (
                        <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                          {lead.pipeline_stage}
                        </span>
                      )}
                      {lead.status === "sent" && (
                        <span className="text-[10px] bg-emerald-900/40 text-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <CheckCircle2 className="h-2.5 w-2.5" /> Sent
                        </span>
                      )}
                      {lead.status === "approved" && (
                        <span className="text-[10px] bg-emerald-900/20 text-emerald-400 px-2 py-0.5 rounded-full">
                          ✅ Approved
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      {lead.phone ? (
                        <span className="flex items-center gap-1 text-indigo-400">
                          <Phone className="h-3 w-3" /> {lead.phone}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-400">
                          <AlertCircle className="h-3 w-3" /> No phone — find in Messages by name
                        </span>
                      )}
                      {lead.days_since !== null && (
                        <span className={cn("flex items-center gap-1", isOverdue && "text-red-400")}>
                          <Clock className="h-3 w-3" /> {lead.days_since}d ago
                        </span>
                      )}
                      {lead.source === "ghl_webhook" && (
                        <span className="text-emerald-400">⚡ New lead</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Last message context */}
                {lead.last_message && (
                  <div className="bg-muted/40 border-l-2 border-border rounded-r-lg px-3 py-2 mb-3">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">
                      Last message — <span className="text-indigo-400">{lead.last_sender === "You" ? "You" : "Them"}</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{lead.last_message}</p>
                  </div>
                )}

                {/* Draft message */}
                <div className="mb-3">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Zap className="h-3 w-3 text-indigo-400" />
                    AI Draft
                    {lead.edited_message && <span className="text-amber-400">(edited)</span>}
                  </div>
                  {isEditing ? (
                    <textarea
                      value={editText}
                      onChange={e => setEditText(e.target.value)}
                      className="w-full bg-amber-50 dark:bg-amber-950/20 text-foreground border-2 border-indigo-500 rounded-lg px-3 py-2 text-sm leading-relaxed resize-none focus:outline-none"
                      rows={3}
                      autoFocus
                    />
                  ) : (
                    <div className="bg-amber-50 dark:bg-amber-950/20 text-foreground rounded-lg px-3 py-2.5 text-sm leading-relaxed border border-amber-200/30">
                      {msg}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                  {lead.status === "sent" ? (
                    <Button variant="outline" size="sm" onClick={() => updateLead(lead.id, { status: "pending_review", sent_at: null })} className="gap-1.5 text-xs h-8">
                      ↩ Undo Sent
                    </Button>
                  ) : lead.status === "skipped" ? (
                    <Button variant="outline" size="sm" onClick={() => updateLead(lead.id, { status: "pending_review" })} className="gap-1.5 text-xs h-8">
                      ↩ Restore
                    </Button>
                  ) : isEditing ? (
                    <>
                      <Button size="sm" onClick={() => saveEdit(lead.id)} className="gap-1.5 text-xs h-8 bg-indigo-600 hover:bg-indigo-700">
                        💾 Save Edit
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setEditingId(null)} className="text-xs h-8">
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      {/* iMessage */}
                      {lead.phone && (
                        <Button size="sm" onClick={() => openIMessage(lead)} className="gap-1.5 text-xs h-8 bg-blue-600 hover:bg-blue-700">
                          <MessageSquare className="h-3 w-3" /> iMessage
                        </Button>
                      )}

                      {/* Send via GHL */}
                      {lead.ghl_contact_id && (
                        <Button size="sm" onClick={() => sendViaGHL(lead)} disabled={isSending} className="gap-1.5 text-xs h-8 bg-emerald-600 hover:bg-emerald-700">
                          {isSending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                          Send via GHL
                        </Button>
                      )}

                      {/* Copy */}
                      <Button variant="outline" size="sm" onClick={() => copyMessage(lead)} className="gap-1.5 text-xs h-8">
                        <Copy className="h-3 w-3" /> Copy
                      </Button>

                      {/* Edit */}
                      <Button variant="outline" size="sm" onClick={() => startEdit(lead)} className="gap-1.5 text-xs h-8">
                        <Edit3 className="h-3 w-3" /> Edit
                      </Button>

                      {/* Approve */}
                      {lead.status !== "approved" && (
                        <Button variant="outline" size="sm" onClick={() => updateLead(lead.id, { status: "approved" })} className="gap-1.5 text-xs h-8 border-emerald-600 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20">
                          <CheckCircle2 className="h-3 w-3" /> Approve
                        </Button>
                      )}

                      {/* Mark sent manually */}
                      <Button variant="outline" size="sm" onClick={() => updateLead(lead.id, { status: "sent", sent_at: new Date().toISOString() })} className="gap-1.5 text-xs h-8">
                        <CheckCircle2 className="h-3 w-3" /> Mark Sent
                      </Button>

                      {/* Skip */}
                      <Button variant="ghost" size="sm" onClick={() => updateLead(lead.id, { status: "skipped" })} className="gap-1.5 text-xs h-8 text-muted-foreground ml-auto">
                        <SkipForward className="h-3 w-3" /> Skip
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={cn(
          "fixed bottom-6 right-6 px-4 py-3 rounded-xl border text-sm font-medium shadow-lg z-50 transition-all",
          "bg-card border-border",
          toast.type === "success" && "border-emerald-600 text-emerald-400",
          toast.type === "error" && "border-red-600 text-red-400",
          toast.type === "warn" && "border-amber-600 text-amber-400",
        )}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
