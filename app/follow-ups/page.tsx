"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  MessageSquare,
  Phone,
  Mail,
  Clock,
  CheckCircle2,
  PauseCircle,
  PlayCircle,
  Loader2,
  Zap,
  RefreshCw,
} from "lucide-react";

interface FollowUp {
  id: string;
  deal_id: string | null;
  contact_name: string;
  contact_phone: string | null;
  contact_email: string | null;
  ghl_contact_id: string | null;
  stage: string;
  sequence_step: number;
  next_action: string;
  next_action_at: string;
  last_action_at: string | null;
  last_action_type: string | null;
  last_action_result: string | null;
  max_attempts: number;
  message_template: string | null;
  notes: string | null;
  created_at: string;
}

const actionIcons: Record<string, typeof MessageSquare> = {
  sms: MessageSquare,
  call: Phone,
  email: Mail,
};

const stageColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  paused: "bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400",
};

export default function FollowUpsPage() {
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "completed" | "paused">("all");

  const fetchFollowUps = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/followups/process");
      const data = await res.json();
      setFollowUps(data.followUps || []);
    } catch {
      console.error("Failed to fetch follow-ups");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFollowUps();
  }, [fetchFollowUps]);

  async function processNow() {
    setProcessing(true);
    try {
      const res = await fetch("/api/followups/process", { method: "POST" });
      const data = await res.json();
      if (data.processed > 0) {
        await fetchFollowUps();
      }
    } catch {
      console.error("Failed to process");
    } finally {
      setProcessing(false);
    }
  }

  async function togglePause(fu: FollowUp) {
    const newStage = fu.stage === "paused" ? "pending" : "paused";
    await fetch("/api/followups/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: fu.id, stage: newStage }),
    });
    await fetchFollowUps();
  }

  const filtered = filter === "all" ? followUps : followUps.filter((fu) => fu.stage === filter);
  const pendingCount = followUps.filter((fu) => fu.stage === "pending").length;
  const completedCount = followUps.filter((fu) => fu.stage === "completed").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Follow-Ups</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            AI-powered outreach sequences — SMS → Call → Email
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchFollowUps}
            disabled={loading}
            className="gap-1.5"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={processNow}
            disabled={processing || pendingCount === 0}
            className="gap-1.5"
          >
            {processing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Zap className="h-3.5 w-3.5" />
            )}
            Process Now ({pendingCount})
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-2xl font-bold">{pendingCount}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Pending</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-2xl font-bold">{completedCount}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Completed</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-2xl font-bold">{followUps.length}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Total</div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-muted/50 rounded-xl p-1 w-fit">
        {(["all", "pending", "completed", "paused"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
              filter === tab
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Follow-up list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-muted-foreground">
            {followUps.length === 0
              ? 'No follow-ups yet. Use the Chat to say "follow up with all leads" to get started.'
              : `No ${filter} follow-ups.`}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((fu) => {
            const ActionIcon = actionIcons[fu.next_action] || Clock;
            const nextDate = new Date(fu.next_action_at);
            const isOverdue = fu.stage === "pending" && nextDate < new Date();

            return (
              <div
                key={fu.id}
                className="bg-card border border-border rounded-xl p-4 flex items-center gap-4"
              >
                {/* Action icon */}
                <div
                  className={cn(
                    "h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
                    fu.stage === "completed"
                      ? "bg-emerald-100 dark:bg-emerald-900/30"
                      : fu.stage === "paused"
                      ? "bg-gray-100 dark:bg-gray-800/50"
                      : "bg-primary/10"
                  )}
                >
                  {fu.stage === "completed" ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <ActionIcon
                      className={cn(
                        "h-5 w-5",
                        fu.stage === "paused"
                          ? "text-gray-400"
                          : "text-primary"
                      )}
                    />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">
                      {fu.contact_name}
                    </span>
                    <span
                      className={cn(
                        "text-[10px] font-medium px-2 py-0.5 rounded-full",
                        stageColors[fu.stage] || stageColors.pending
                      )}
                    >
                      {fu.stage}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span>
                      Step {fu.sequence_step}/{fu.max_attempts}
                    </span>
                    {fu.stage === "pending" && (
                      <span className={isOverdue ? "text-red-500 font-medium" : ""}>
                        Next: {fu.next_action.toUpperCase()}{" "}
                        {isOverdue ? "(overdue)" : `on ${nextDate.toLocaleDateString()}`}
                      </span>
                    )}
                    {fu.last_action_result && (
                      <span className="truncate">Last: {fu.last_action_result}</span>
                    )}
                  </div>
                </div>

                {/* Sequence dots */}
                <div className="flex gap-1 shrink-0">
                  {["sms", "call", "email"].map((step, i) => (
                    <div
                      key={step}
                      className={cn(
                        "h-2 w-2 rounded-full",
                        i < fu.sequence_step
                          ? "bg-emerald-500"
                          : i === fu.sequence_step && fu.stage === "pending"
                          ? "bg-primary animate-pulse"
                          : "bg-muted-foreground/20"
                      )}
                      title={step.toUpperCase()}
                    />
                  ))}
                </div>

                {/* Actions */}
                {fu.stage !== "completed" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => togglePause(fu)}
                    className="shrink-0 h-8 w-8 p-0"
                    title={fu.stage === "paused" ? "Resume" : "Pause"}
                  >
                    {fu.stage === "paused" ? (
                      <PlayCircle className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <PauseCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
