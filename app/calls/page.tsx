"use client";

import { useStore } from "@/lib/hooks";
import { addCall, updateSettings } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FilterChips } from "@/components/filter-chips";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Phone, Clock, Users, RefreshCw, Settings, Check, AlertCircle } from "lucide-react";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useState } from "react";

export default function CallsPage() {
  const { calls, deals, salespeople, settings, refresh, loaded } = useStore();
  const [filterSp, setFilterSp] = useState("all");
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [apiKey, setApiKey] = useState(settings.tldvApiKey || "");

  if (!loaded) return <div className="animate-pulse h-96" />;

  const spOptions = [
    { value: "all", label: "All" },
    ...salespeople.map((sp) => ({ value: sp.id, label: sp.name })),
  ];

  const filteredCalls = (filterSp === "all" ? calls : calls.filter((c) => c.salespersonId === filterSp))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Auto-assign a call to a salesperson based on participants
  function assignCall(participants: string[]): string {
    const names = participants.map((n) => n.toLowerCase().trim());
    const team = salespeople.map((sp) => ({
      id: sp.id,
      name: sp.name.toLowerCase(),
      role: sp.role,
    }));

    // Find matching team members
    const matches = team.filter((t) =>
      names.some((n) => n.includes(t.name) || t.name.includes(n))
    );

    // If only Matthew matched (founder), assign to him
    if (matches.length === 1) return matches[0].id;

    // If multiple matched, prefer a rep over the founder
    const reps = matches.filter((m) => m.role === "rep");
    if (reps.length > 0) return reps[0].id;

    // Fallback: if no match, assign to first rep
    const firstRep = team.find((t) => t.role === "rep");
    return firstRep?.id || team[0]?.id || "";
  }

  async function handleSync() {
    const key = settings.tldvApiKey;
    if (!key) {
      setSyncResult({ type: "error", message: "Set your tl;dv API key first" });
      setSettingsOpen(true);
      return;
    }

    setSyncing(true);
    setSyncResult(null);

    try {
      const res = await fetch("/api/tldv/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: key,
          since: settings.tldvLastSync || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setSyncResult({ type: "error", message: data.error || "Sync failed" });
        return;
      }

      // Deduplicate — skip meetings we already have by title + date
      const existingKeys = new Set(calls.map((c) => `${c.title}|${c.date}`));
      let imported = 0;

      for (const meeting of data.meetings) {
        const key = `${meeting.title}|${meeting.date}`;
        if (existingKeys.has(key)) continue;

        const spId = assignCall(meeting.participants);

        await addCall({
          title: meeting.title,
          date: meeting.date,
          duration: meeting.duration,
          participants: meeting.participants,
          salespersonId: spId,
          summary: meeting.summary,
          transcript: "",
          dealId: null,
          source: "tldv",
        });

        imported++;
      }

      await updateSettings({ tldvLastSync: data.syncedAt });
      await refresh();
      setSyncResult({
        type: "success",
        message: imported > 0
          ? `Synced ${imported} new call${imported !== 1 ? "s" : ""} from tl;dv`
          : `Already up to date (${data.count} meetings checked)`,
      });
    } catch (err) {
      setSyncResult({ type: "error", message: "Network error. Check your connection." });
    } finally {
      setSyncing(false);
    }
  }

  async function handleSaveApiKey() {
    await updateSettings({ tldvApiKey: apiKey.trim() });
    await refresh();
    setSettingsOpen(false);
    setSyncResult(null);
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Sales Calls</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {filteredCalls.length} call{filteredCalls.length !== 1 ? "s" : ""} recorded
            {settings.tldvLastSync && (
              <span> &middot; Last sync {formatDate(settings.tldvLastSync.split("T")[0])}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs"
            onClick={handleSync}
            disabled={syncing}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} />
            {syncing ? "Syncing..." : "Sync tl;dv"}
          </Button>
          <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
            <DialogTrigger render={<Button size="sm" variant="ghost" className="h-8 w-8 p-0" />}>
              <Settings className="h-4 w-4" />
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>tl;dv Settings</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">API Key</label>
                  <Input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="tldv_api_..."
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Get your API key from tldv.io &rarr; Settings &rarr; Integrations &rarr; API
                  </p>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setSettingsOpen(false)}>Cancel</Button>
                  <Button size="sm" onClick={handleSaveApiKey} disabled={!apiKey.trim()}>Save Key</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Sync result banner */}
      {syncResult && (
        <div className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg text-sm",
          syncResult.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
        )}>
          {syncResult.type === "success" ? <Check className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
          {syncResult.message}
        </div>
      )}

      <FilterChips options={spOptions} value={filterSp} onChange={setFilterSp} />

      {filteredCalls.length === 0 ? (
        <Card className="border shadow-none">
          <CardContent className="py-12 text-center">
            <Phone className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-3">
              No calls yet. Connect tl;dv to sync your sales calls automatically.
            </p>
            {!settings.tldvApiKey && (
              <Button size="sm" variant="outline" onClick={() => setSettingsOpen(true)} className="gap-1.5">
                <Settings className="h-3.5 w-3.5" />
                Set up tl;dv
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredCalls.map((call) => {
            const sp = salespeople.find((s) => s.id === call.salespersonId);
            const deal = call.dealId ? deals.find((d) => d.id === call.dealId) : null;

            return (
              <Card key={call.id} className="border shadow-none">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                        call.source === "tldv" ? "bg-blue-100" : "bg-gray-100"
                      )}>
                        <Phone className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-sm font-medium">{call.title}</h3>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                          <span>{formatDate(call.date)}</span>
                          <span className="flex items-center gap-0.5">
                            <Clock className="h-3 w-3" />
                            {call.duration}min
                          </span>
                          <span className="flex items-center gap-0.5">
                            <Users className="h-3 w-3" />
                            {call.participants.join(", ")}
                          </span>
                        </div>
                      </div>
                    </div>
                    {call.source === "tldv" && (
                      <span className="text-[10px] font-medium bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">tl;dv</span>
                    )}
                  </div>

                  {call.summary && (
                    <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3 mb-2">{call.summary}</p>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {sp && (
                        <div className="flex items-center gap-1.5">
                          <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-[9px] font-semibold">
                            {sp.name.charAt(0)}
                          </div>
                          <span className="text-[11px] text-muted-foreground">{sp.name}</span>
                        </div>
                      )}
                      {deal && (
                        <span className="text-[11px] bg-muted px-2 py-0.5 rounded-md">
                          Linked: {deal.clientName}
                        </span>
                      )}
                    </div>
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
