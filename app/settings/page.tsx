"use client";

import { useStore } from "@/lib/hooks";
import { updateSettings } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Check, AlertCircle, RefreshCw, ExternalLink } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const { settings, deals, refresh, loaded } = useStore();

  // tl;dv
  const [tldvKey, setTldvKey] = useState("");
  const [tldvSaved, setTldvSaved] = useState(false);

  // GHL
  const [ghlKey, setGhlKey] = useState("");
  const [ghlLocationId, setGhlLocationId] = useState("");
  const [ghlSaved, setGhlSaved] = useState(false);
  const [ghlSyncing, setGhlSyncing] = useState(false);
  const [ghlResult, setGhlResult] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    if (loaded) {
      setTldvKey(settings.tldvApiKey || "");
      setGhlKey(settings.ghlApiKey || "");
      setGhlLocationId(settings.ghlLocationId || "");
    }
  }, [loaded, settings]);

  if (!loaded) return <div className="animate-pulse h-96" />;

  function saveTldv() {
    updateSettings({ tldvApiKey: tldvKey.trim() });
    refresh();
    setTldvSaved(true);
    setTimeout(() => setTldvSaved(false), 2000);
  }

  function saveGhl() {
    updateSettings({ ghlApiKey: ghlKey.trim(), ghlLocationId: ghlLocationId.trim() });
    refresh();
    setGhlSaved(true);
    setTimeout(() => setGhlSaved(false), 2000);
  }

  async function syncGhl() {
    const key = ghlKey.trim() || settings.ghlApiKey;
    const locId = ghlLocationId.trim() || settings.ghlLocationId;

    if (!key || !locId) {
      setGhlResult({ type: "error", message: "Save your API key and Location ID first" });
      return;
    }

    setGhlSyncing(true);
    setGhlResult(null);

    try {
      const res = await fetch("/api/ghl/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: key,
          locationId: locId,
          since: settings.ghlLastSync || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setGhlResult({ type: "error", message: data.error || "Sync failed" });
        return;
      }

      // Check contacts against existing deals to show lead source info
      const existingClients = new Set(deals.map((d) => d.clientName.toLowerCase()));
      const newContacts = data.contacts.filter(
        (c: { name: string }) => !existingClients.has(c.name.toLowerCase())
      );

      updateSettings({ ghlLastSync: data.syncedAt });
      refresh();

      setGhlResult({
        type: "success",
        message: `Found ${data.count} contacts (${newContacts.length} new). Lead sources synced.`,
      });
    } catch {
      setGhlResult({ type: "error", message: "Network error. Check your connection." });
    } finally {
      setGhlSyncing(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage integrations and API keys</p>
      </div>

      {/* GHL Integration */}
      <Card className="border shadow-none">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">GoHighLevel</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Sync contacts and lead source tags from GHL
              </p>
            </div>
            <div className="flex items-center gap-2">
              {settings.ghlApiKey && (
                <span className="text-[10px] font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full">
                  Connected
                </span>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">API Key (Private Integration)</label>
              <Input
                type="password"
                value={ghlKey}
                onChange={(e) => setGhlKey(e.target.value)}
                placeholder="pit-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className="font-mono text-xs"
              />
              <p className="text-[10px] text-muted-foreground">
                GHL &rarr; Settings &rarr; Private Integrations &rarr; Create/Copy Key
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">Location ID (Sub-Account)</label>
              <Input
                value={ghlLocationId}
                onChange={(e) => setGhlLocationId(e.target.value)}
                placeholder="xxxxxxxxxxxxxxxxxxxxxxxx"
                className="font-mono text-xs"
              />
              <p className="text-[10px] text-muted-foreground">
                GHL &rarr; Settings &rarr; Business Info &rarr; look for Location ID in the URL or Company page
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" onClick={saveGhl} disabled={!ghlKey.trim() || !ghlLocationId.trim()}>
              {ghlSaved ? (
                <span className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5" /> Saved
                </span>
              ) : (
                "Save"
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={syncGhl}
              disabled={ghlSyncing || !settings.ghlApiKey}
              className="gap-1.5"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", ghlSyncing && "animate-spin")} />
              {ghlSyncing ? "Syncing..." : "Sync Now"}
            </Button>
            {settings.ghlLastSync && (
              <span className="text-[10px] text-muted-foreground ml-auto">
                Last sync: {new Date(settings.ghlLastSync).toLocaleString()}
              </span>
            )}
          </div>

          {ghlResult && (
            <div
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg text-xs",
                ghlResult.type === "success"
                  ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400"
                  : "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400"
              )}
            >
              {ghlResult.type === "success" ? (
                <Check className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              )}
              {ghlResult.message}
            </div>
          )}
        </CardContent>
      </Card>

      {/* tl;dv Integration */}
      <Card className="border shadow-none">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">tl;dv</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Sync sales call recordings and transcripts
              </p>
            </div>
            {settings.tldvApiKey && (
              <span className="text-[10px] font-medium bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full">
                Connected
              </span>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium">API Key</label>
            <Input
              type="password"
              value={tldvKey}
              onChange={(e) => setTldvKey(e.target.value)}
              placeholder="tldv_api_..."
              className="font-mono text-xs"
            />
            <p className="text-[10px] text-muted-foreground">
              tldv.io &rarr; Settings &rarr; Integrations &rarr; API
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" onClick={saveTldv} disabled={!tldvKey.trim()}>
              {tldvSaved ? (
                <span className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5" /> Saved
                </span>
              ) : (
                "Save"
              )}
            </Button>
            {settings.tldvLastSync && (
              <span className="text-[10px] text-muted-foreground ml-auto">
                Last sync: {new Date(settings.tldvLastSync).toLocaleString()}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

