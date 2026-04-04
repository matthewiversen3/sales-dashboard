"use client";

import { useStore } from "@/lib/hooks";
import { updateSettings } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Check, AlertCircle, RefreshCw, Phone, Bot, Copy } from "lucide-react";
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

  // AI Chat
  const [anthropicKey, setAnthropicKey] = useState("");
  const [anthropicSaved, setAnthropicSaved] = useState(false);

  // AI Calling
  const [blandKey, setBlandKey] = useState("");
  const [blandPathwayId, setBlandPathwayId] = useState("");
  const [aiCallingEnabled, setAiCallingEnabled] = useState(false);
  const [aiGreeting, setAiGreeting] = useState("");
  const [callingSaved, setCallingSaved] = useState(false);
  const [webhookCopied, setWebhookCopied] = useState(false);

  useEffect(() => {
    if (loaded) {
      setTldvKey(settings.tldvApiKey || "");
      setGhlKey(settings.ghlApiKey || "");
      setGhlLocationId(settings.ghlLocationId || "");
      setAnthropicKey(settings.anthropicApiKey || "");
      setBlandKey(settings.blandApiKey || "");
      setBlandPathwayId(settings.blandPathwayId || "");
      setAiCallingEnabled(settings.aiCallingEnabled === "true");
      setAiGreeting(settings.aiCallingGreeting || "");
    }
  }, [loaded, settings]);

  if (!loaded) return <div className="animate-pulse h-96" />;

  const webhookUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/ghl/webhook`
    : "/api/ghl/webhook";

  async function saveTldv() {
    await updateSettings({ tldvApiKey: tldvKey.trim() });
    await refresh();
    setTldvSaved(true);
    setTimeout(() => setTldvSaved(false), 2000);
  }

  async function saveGhl() {
    await updateSettings({ ghlApiKey: ghlKey.trim(), ghlLocationId: ghlLocationId.trim() });
    await refresh();
    setGhlSaved(true);
    setTimeout(() => setGhlSaved(false), 2000);
  }

  async function saveAnthropic() {
    await updateSettings({ anthropicApiKey: anthropicKey.trim() });
    await refresh();
    setAnthropicSaved(true);
    setTimeout(() => setAnthropicSaved(false), 2000);
  }

  async function saveCalling() {
    await updateSettings({
      blandApiKey: blandKey.trim(),
      blandPathwayId: blandPathwayId.trim(),
      aiCallingEnabled: aiCallingEnabled ? "true" : "false",
      aiCallingGreeting: aiGreeting.trim(),
    });
    await refresh();
    setCallingSaved(true);
    setTimeout(() => setCallingSaved(false), 2000);
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

      const existingClients = new Set(deals.map((d) => d.clientName.toLowerCase()));
      const newContacts = data.contacts.filter(
        (c: { name: string }) => !existingClients.has(c.name.toLowerCase())
      );

      await updateSettings({ ghlLastSync: data.syncedAt });
      await refresh();

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

  function copyWebhookUrl() {
    navigator.clipboard.writeText(webhookUrl);
    setWebhookCopied(true);
    setTimeout(() => setWebhookCopied(false), 2000);
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage integrations and API keys</p>
      </div>

      {/* AI Chat */}
      <Card className="border shadow-none">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">AI Chat Assistant</h2>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Talk to your dashboard — add deals, update pipeline, verify payments
              </p>
            </div>
            {settings.anthropicApiKey && (
              <span className="text-[10px] font-medium bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 px-2 py-0.5 rounded-full">
                Connected
              </span>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium">Anthropic API Key</label>
            <Input
              type="password"
              value={anthropicKey}
              onChange={(e) => setAnthropicKey(e.target.value)}
              placeholder="sk-ant-..."
              className="font-mono text-xs"
            />
            <p className="text-[10px] text-muted-foreground">
              console.anthropic.com &rarr; API Keys &rarr; Create Key
            </p>
          </div>

          <Button size="sm" onClick={saveAnthropic} disabled={!anthropicKey.trim()}>
            {anthropicSaved ? (
              <span className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5" /> Saved
              </span>
            ) : (
              "Save"
            )}
          </Button>
        </CardContent>
      </Card>

      {/* AI Calling */}
      <Card className="border shadow-none">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-orange-500" />
                <h2 className="text-sm font-semibold">AI Auto-Calling</h2>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Automatically call new GHL leads via Bland.ai
              </p>
            </div>
            {aiCallingEnabled && settings.blandApiKey && (
              <span className="text-[10px] font-medium bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded-full">
                Active
              </span>
            )}
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Bland.ai API Key</label>
              <Input
                type="password"
                value={blandKey}
                onChange={(e) => setBlandKey(e.target.value)}
                placeholder="sk-..."
                className="font-mono text-xs"
              />
              <p className="text-[10px] text-muted-foreground">
                app.bland.ai &rarr; API Keys
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">Pathway ID (optional)</label>
              <Input
                value={blandPathwayId}
                onChange={(e) => setBlandPathwayId(e.target.value)}
                placeholder="Leave blank for default script"
                className="font-mono text-xs"
              />
              <p className="text-[10px] text-muted-foreground">
                If you have a custom Bland.ai pathway, paste the ID here
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">Opening Line</label>
              <Input
                value={aiGreeting}
                onChange={(e) => setAiGreeting(e.target.value)}
                placeholder="Hi, this is a representative from AppRabbit..."
                className="text-xs"
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setAiCallingEnabled(!aiCallingEnabled)}
                className={cn(
                  "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                  aiCallingEnabled ? "bg-emerald-500" : "bg-muted-foreground/30"
                )}
              >
                <span
                  className={cn(
                    "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                    aiCallingEnabled ? "translate-x-4" : "translate-x-0"
                  )}
                />
              </button>
              <span className="text-xs font-medium">
                {aiCallingEnabled ? "Auto-calling enabled" : "Auto-calling disabled"}
              </span>
            </div>

            {/* Webhook URL */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium">GHL Webhook URL</label>
              <div className="flex gap-2">
                <Input
                  value={webhookUrl}
                  readOnly
                  className="font-mono text-[11px] bg-muted"
                />
                <Button size="sm" variant="outline" onClick={copyWebhookUrl} className="shrink-0 gap-1.5">
                  {webhookCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {webhookCopied ? "Copied" : "Copy"}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Add this URL in GHL &rarr; Automation &rarr; Workflows &rarr; Trigger: Contact Created &rarr; Action: Webhook
              </p>
            </div>
          </div>

          <Button size="sm" onClick={saveCalling}>
            {callingSaved ? (
              <span className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5" /> Saved
              </span>
            ) : (
              "Save"
            )}
          </Button>
        </CardContent>
      </Card>

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
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">Location ID (Sub-Account)</label>
              <Input
                value={ghlLocationId}
                onChange={(e) => setGhlLocationId(e.target.value)}
                placeholder="xxxxxxxxxxxxxxxxxxxxxxxx"
                className="font-mono text-xs"
              />
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
          </div>

          <Button size="sm" onClick={saveTldv} disabled={!tldvKey.trim()}>
            {tldvSaved ? (
              <span className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5" /> Saved
              </span>
            ) : (
              "Save"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
