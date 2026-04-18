import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

const GHL_API_BASE = "https://services.leadconnectorhq.com";

export async function POST(req: NextRequest) {
  const supabase = createServiceClient();
  const { id, message } = await req.json();

  if (!id || !message) {
    return NextResponse.json({ error: "Missing id or message" }, { status: 400 });
  }

  // Get the lead
  const { data: lead, error: fetchErr } = await supabase
    .from("outreach_queue")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchErr || !lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  if (!lead.ghl_contact_id) {
    return NextResponse.json({ ok: false, error: "No GHL contact ID — use iMessage instead" });
  }

  // Get GHL API key from app_settings
  const { data: settings } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "ghlApiKey")
    .single();

  const ghlKey = settings?.value;
  if (!ghlKey) {
    return NextResponse.json({ ok: false, error: "GHL API key not configured in Settings" });
  }

  // Send SMS via GHL
  try {
    const res = await fetch(`${GHL_API_BASE}/conversations/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ghlKey}`,
        Version: "2021-07-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "SMS",
        contactId: lead.ghl_contact_id,
        message,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ ok: false, error: err });
    }

    // Mark as sent in DB
    await supabase
      .from("outreach_queue")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Send failed" });
  }
}
