// /systems — visual ops control room
// Shows every cron job + automation + agent + integration with live status.
// "Don't get lost in the sauce."

export const dynamic = "force-dynamic";

import { createServiceClient } from "@/lib/supabase";

type SystemRow = {
  name: string;
  category: "cron" | "agent" | "integration" | "skill" | "data-pipeline";
  owner: "brain" | "sales-worker" | "hops" | "dashboard" | "external";
  schedule: string;
  status: "ok" | "warn" | "down" | "unknown";
  last_seen?: string;
  notes?: string;
  doc_path?: string;
};

// Static system inventory — single source of truth on what's running.
// As new things get built, add a row. Status detection rules in detect() below.
const SYSTEMS: SystemRow[] = [
  // ── crons (Mac Mini) ──
  { name: "sync-watchdog", category: "cron", owner: "brain", schedule: "every 15 min", status: "unknown", doc_path: "apprabbit-claude-config/scripts/sync-watchdog.sh", notes: "pulls + pushes brain inbox/daily across all machines" },
  { name: "consolidate.sh", category: "cron", owner: "brain", schedule: "9pm daily", status: "unknown", doc_path: "apprabbit-brain/scripts/consolidate.sh", notes: "promotes inbox notes to canonical brain via Claude" },
  { name: "brain-to-knowledge-chunks.sh", category: "cron", owner: "brain", schedule: "9:30pm daily", status: "unknown", doc_path: "apprabbit-brain/scripts/brain-to-knowledge-chunks.sh", notes: "embeds brain markdown to pgvector" },
  { name: "stripe-sync.sh", category: "cron", owner: "brain", schedule: "hourly", status: "unknown", doc_path: "apprabbit-brain/scripts/stripe-sync.sh", notes: "Stripe → people LTV + subscription_status" },
  { name: "/sales-watch", category: "cron", owner: "brain", schedule: "every 10min, 8am-9pm", status: "unknown", notes: "hot lead detector → DMs Matt" },
  { name: "/daily-digest", category: "cron", owner: "brain", schedule: "9am daily", status: "unknown", notes: "morning Slack briefing" },
  { name: "/weekly-doug-sync", category: "cron", owner: "brain", schedule: "Sun 6pm", status: "unknown", notes: "auto status to Doug" },
  { name: "/prompt-learn", category: "cron", owner: "brain", schedule: "hourly", status: "unknown", notes: "prompt_edits → prompt_proposals" },
  { name: "/broll-finder", category: "cron", owner: "brain", schedule: "11pm daily", status: "unknown", notes: "auto B-roll content engine (v1)" },
  { name: "heartbeat.sh", category: "cron", owner: "brain", schedule: "8am daily", status: "unknown", notes: "alerts Slack if any cron silent >48h" },

  // ── crons (Railway) ──
  { name: "pollIG", category: "cron", owner: "sales-worker", schedule: "every 60s", status: "unknown", notes: "Instagram inbound polling" },
  { name: "runDrip", category: "cron", owner: "sales-worker", schedule: "every 60s", status: "unknown", notes: "outbound drip processor" },
  { name: "Hops Gmail poll", category: "cron", owner: "hops", schedule: "every 5 min", status: "unknown", notes: "support@apprabbit.com inbox" },
  { name: "Hops WhatsApp listener", category: "cron", owner: "hops", schedule: "continuous", status: "unknown", notes: "Evolution API webhook" },
  { name: "Sales-dashboard /api/cron/nightly", category: "cron", owner: "dashboard", schedule: "hourly", status: "unknown", notes: "GHL + tldv sync, payment notifications" },

  // ── agents ──
  { name: "Hops (whatsapp-agent-server)", category: "agent", owner: "hops", schedule: "continuous", status: "unknown", notes: "WA + email + Slack reaction handler" },
  { name: "Hazel (email campaign manager)", category: "agent", owner: "sales-worker", schedule: "continuous", status: "unknown", notes: "Instantly outbound" },
  { name: "Bland.ai voice setter", category: "agent", owner: "external", schedule: "on lead webhook", status: "warn", notes: "key not yet in production per HANDOFF.md" },
  { name: "Warren (CEO agent)", category: "agent", owner: "brain", schedule: "on-demand", status: "ok", notes: "loads frameworks/ + brain/, advises Doug" },

  // ── integrations ──
  { name: "Supabase moubgrlblpslayigufxm", category: "integration", owner: "brain", schedule: "always-on", status: "ok", notes: "canonical CRM + sales + pgvector" },
  { name: "Stripe", category: "integration", owner: "brain", schedule: "synced hourly", status: "ok", notes: "via stripe-sync.sh" },
  { name: "GoHighLevel (GHL)", category: "integration", owner: "dashboard", schedule: "synced hourly", status: "unknown", notes: "via /api/cron/nightly" },
  { name: "tl;dv", category: "integration", owner: "dashboard", schedule: "synced hourly", status: "ok", notes: "fixed pasta.tldv.io URL — needs Matt's git push" },
  { name: "Slack", category: "integration", owner: "brain", schedule: "always-on", status: "ok", notes: "all bots + #ai-ops + #squad + DMs" },
  { name: "OpenAI (embeddings)", category: "integration", owner: "brain", schedule: "as-needed", status: "ok", notes: "text-embedding-3-small for knowledge_chunks" },
  { name: "Anthropic Claude API", category: "integration", owner: "brain", schedule: "always-on", status: "ok", notes: "all bots + dashboard chat + cron skills" },
  { name: "11labs (voice)", category: "integration", owner: "external", schedule: "as-needed", status: "warn", notes: "paid for, voice clone not yet trained" },
  { name: "Late API (multi-platform posting)", category: "integration", owner: "brain", schedule: "as-needed", status: "unknown", notes: "needs LATE_API_KEY in env" },
  { name: "Apify (scrapers)", category: "integration", owner: "brain", schedule: "as-needed", status: "ok" },

  // ── data pipelines ──
  { name: "people + interactions CRM (Hops dual-write)", category: "data-pipeline", owner: "hops", schedule: "real-time", status: "ok" },
  { name: "messages + conversations (sales-worker)", category: "data-pipeline", owner: "sales-worker", schedule: "real-time", status: "ok" },
  { name: "knowledge_chunks (brain markdown → pgvector)", category: "data-pipeline", owner: "brain", schedule: "9:30pm daily", status: "ok", notes: "smoke-tested" },
  { name: "Brain consolidator (inbox → canonical)", category: "data-pipeline", owner: "brain", schedule: "9pm daily", status: "unknown" },
  { name: "Self-learning prompt loop (prompt_edits → proposals)", category: "data-pipeline", owner: "sales-worker", schedule: "hourly (designed)", status: "unknown", notes: "Mac Mini cron not yet running" },
  { name: "Stripe → people sync", category: "data-pipeline", owner: "brain", schedule: "hourly", status: "ok", notes: "smoke-tested live; cron not yet on Mac Mini" },
];

// Detect runtime status by checking Supabase for activity signals where possible.
async function detect(): Promise<Record<string, { status: SystemRow["status"]; last_seen?: string }>> {
  const supabase = createServiceClient();
  const result: Record<string, { status: SystemRow["status"]; last_seen?: string }> = {};

  // Hops dual-write health = recent interactions row
  const { data: lastInteraction } = await supabase
    .from("interactions")
    .select("created_at")
    .order("created_at", { ascending: false })
    .limit(1);
  if (lastInteraction?.[0]) {
    const age = Date.now() - new Date(lastInteraction[0].created_at).getTime();
    result["people + interactions CRM (Hops dual-write)"] = {
      status: age < 24 * 3600_000 ? "ok" : age < 7 * 86400_000 ? "warn" : "down",
      last_seen: lastInteraction[0].created_at
    };
  }

  // Sales-worker messages health
  const { data: lastMsg } = await supabase
    .from("messages")
    .select("ingested_at")
    .order("ingested_at", { ascending: false })
    .limit(1);
  if (lastMsg?.[0]) {
    const age = Date.now() - new Date(lastMsg[0].ingested_at).getTime();
    result["messages + conversations (sales-worker)"] = {
      status: age < 24 * 3600_000 ? "ok" : age < 7 * 86400_000 ? "warn" : "down",
      last_seen: lastMsg[0].ingested_at
    };
  }

  // Stripe sync — most recent person with stripe_synced_at attribute
  const { data: lastStripe } = await supabase
    .from("people")
    .select("attributes, updated_at")
    .not("attributes->>stripe_synced_at", "is", null)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (lastStripe?.[0]?.attributes?.stripe_synced_at) {
    const age = Date.now() - new Date(lastStripe[0].attributes.stripe_synced_at).getTime();
    result["Stripe → people sync"] = {
      status: age < 2 * 3600_000 ? "ok" : age < 24 * 3600_000 ? "warn" : "down",
      last_seen: lastStripe[0].attributes.stripe_synced_at
    };
  }

  // knowledge_chunks freshness
  const { data: lastChunk } = await supabase
    .from("knowledge_chunks")
    .select("created_at")
    .order("created_at", { ascending: false })
    .limit(1);
  if (lastChunk?.[0]) {
    const age = Date.now() - new Date(lastChunk[0].created_at).getTime();
    result["knowledge_chunks (brain markdown → pgvector)"] = {
      status: age < 48 * 3600_000 ? "ok" : "warn",
      last_seen: lastChunk[0].created_at
    };
  }

  return result;
}

const STATUS_DOT = {
  ok: "bg-green-500",
  warn: "bg-yellow-500",
  down: "bg-red-500",
  unknown: "bg-zinc-600"
} as const;

export default async function SystemsPage() {
  const detected = await detect();

  // Merge detected into static SYSTEMS list
  const systems = SYSTEMS.map((s) => ({
    ...s,
    ...(detected[s.name] || {})
  }));

  const grouped = systems.reduce<Record<string, typeof systems>>((acc, s) => {
    (acc[s.category] ||= []).push(s);
    return acc;
  }, {});

  const counts = systems.reduce(
    (acc, s) => {
      acc[s.status] = (acc[s.status] || 0) + 1;
      return acc;
    },
    {} as Record<SystemRow["status"], number>
  );

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Systems</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Every cron, agent, integration, skill, and data pipeline. Everything Claude is doing for AppRabbit. Don&apos;t get lost in the sauce.
        </p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(["ok", "warn", "down", "unknown"] as const).map((st) => (
          <div key={st} className="rounded-lg border p-3 flex items-center gap-3">
            <span className={`w-3 h-3 rounded-full ${STATUS_DOT[st]}`} />
            <div className="flex-1">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">{st}</div>
              <div className="text-2xl font-semibold">{counts[st] || 0}</div>
            </div>
          </div>
        ))}
      </div>

      {(["cron", "agent", "integration", "data-pipeline", "skill"] as const).map((cat) => {
        const rows = grouped[cat] || [];
        if (!rows.length) return null;
        return (
          <section key={cat} className="rounded-lg border p-5">
            <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground mb-3">
              {cat} ({rows.length})
            </h2>
            <ul className="space-y-2">
              {rows.map((s) => (
                <li key={s.name} className="flex items-start gap-3 text-sm">
                  <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[s.status]}`} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium flex items-center gap-2 flex-wrap">
                      <span>{s.name}</span>
                      <span className="text-xs rounded bg-muted px-1.5 py-0.5">{s.owner}</span>
                      <span className="text-xs text-muted-foreground">· {s.schedule}</span>
                    </div>
                    {s.notes && <div className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{s.notes}</div>}
                    <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                      {s.last_seen && <span>last seen: {new Date(s.last_seen).toLocaleString()}</span>}
                      {s.doc_path && <code className="text-[10px]">{s.doc_path}</code>}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <p className="text-xs text-muted-foreground border-t pt-4">
        Status detection rules: <code>last_seen</code> is computed from Supabase for things that write rows (interactions, messages,
        knowledge_chunks, people.stripe_synced_at). For crons that don&apos;t write Supabase rows, status defaults to unknown — install
        the Mac Mini heartbeat cron to get those ✅. Add new systems by editing
        <code className="ml-1">app/systems/page.tsx</code>.
      </p>
    </div>
  );
}
