import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

// GET: list all outreach leads
export async function GET(req: NextRequest) {
  const supabase = createServiceClient();
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const temp = url.searchParams.get("temperature");

  let query = supabase
    .from("outreach_queue")
    .select("*")
    .order("temperature", { ascending: true }) // hot first (alphabetical: cold, hot, warm — we sort client-side)
    .order("days_since", { ascending: false }); // most overdue first

  if (status) query = query.eq("status", status);
  if (temp) query = query.eq("temperature", temp);

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ leads: data });
}

// PATCH: update a lead (status, edited_message, etc.)
export async function PATCH(req: NextRequest) {
  const supabase = createServiceClient();
  const { id, ...updates } = await req.json();

  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const { error } = await supabase
    .from("outreach_queue")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// POST: add leads to the queue (for bulk import from JSON)
export async function POST(req: NextRequest) {
  const supabase = createServiceClient();
  const body = await req.json();
  const leads = Array.isArray(body) ? body : [body];

  const rows = leads.map((l: Record<string, unknown>) => ({
    contact_name: l.n || l.contact_name,
    phone: l.p || l.phone || null,
    temperature: (l.t || l.temperature || "cold") as string,
    pipeline_stage: l.pl || l.pipeline_stage || null,
    draft_message: l.dm || l.draft_message || "",
    last_message: l.lm || l.last_message || null,
    last_sender: l.ls || l.last_sender || null,
    last_contact_date: l.lcd || l.last_contact_date || null,
    days_since: l.d || l.days_since || null,
    status: "pending_review",
    source: l.source || "import",
    ghl_contact_id: l.ghl_contact_id || null,
  }));

  const { data, error } = await supabase
    .from("outreach_queue")
    .upsert(rows, { onConflict: "contact_name,phone" })
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, inserted: data?.length });
}
