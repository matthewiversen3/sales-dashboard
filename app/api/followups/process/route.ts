import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

const GHL_API_BASE = "https://services.leadconnectorhq.com";

async function getSettings(supabase: ReturnType<typeof createServiceClient>) {
  const { data } = await supabase
    .from("app_settings")
    .select("*")
    .in("key", ["ghlApiKey", "ghlLocationId", "blandApiKey", "blandPathwayId", "aiCallingGreeting"]);
  const get = (k: string) => data?.find((s: Record<string, unknown>) => s.key === k)?.value || "";
  return {
    ghlKey: get("ghlApiKey"),
    ghlLocId: get("ghlLocationId"),
    blandKey: get("blandApiKey"),
    blandPathwayId: get("blandPathwayId"),
    aiCallingGreeting: get("aiCallingGreeting"),
  };
}

// Send SMS via GHL
async function sendGhlSms(
  contactId: string,
  message: string,
  ghlKey: string
): Promise<{ ok: boolean; error?: string }> {
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
        contactId,
        message,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      return { ok: false, error: err };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "SMS failed" };
  }
}

// Trigger Bland.ai call
async function triggerBlandCall(
  phone: string,
  name: string,
  blandKey: string,
  pathwayId: string,
  greeting: string
): Promise<{ ok: boolean; callId?: string; error?: string }> {
  try {
    const body: Record<string, unknown> = {
      phone_number: phone,
      task: `Follow up with ${name}. ${greeting || "Hey, this is a follow-up call from AppRabbit. We wanted to check in and see if you had any questions about what we discussed."}`,
      voice: "maya",
      reduce_latency: true,
      max_duration: 3,
    };
    if (pathwayId) body.pathway_id = pathwayId;

    const res = await fetch("https://api.bland.ai/v1/calls", {
      method: "POST",
      headers: {
        Authorization: blandKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.text();
      return { ok: false, error: err };
    }
    const data = await res.json();
    return { ok: true, callId: data.call_id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Call failed" };
  }
}

// Send email via GHL
async function sendGhlEmail(
  contactId: string,
  subject: string,
  htmlBody: string,
  ghlKey: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${GHL_API_BASE}/conversations/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ghlKey}`,
        Version: "2021-07-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "Email",
        contactId,
        subject,
        html: htmlBody,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      return { ok: false, error: err };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Email failed" };
  }
}

// Process a single follow-up
async function processFollowUp(
  followUp: Record<string, unknown>,
  settings: Awaited<ReturnType<typeof getSettings>>,
  supabase: ReturnType<typeof createServiceClient>
): Promise<{ action: string; result: string }> {
  const step = followUp.sequence_step as number;
  const action = followUp.next_action as string;
  const name = followUp.contact_name as string;
  const phone = followUp.contact_phone as string;
  const email = followUp.contact_email as string;
  const ghlContactId = followUp.ghl_contact_id as string;
  const template = followUp.message_template as string;
  const maxAttempts = followUp.max_attempts as number;

  const defaultMessage = template || `Hey ${name}, just following up from our earlier conversation about your app project. Would love to chat when you have a moment!`;

  let result = "";
  let success = false;

  if (action === "sms" && ghlContactId && settings.ghlKey) {
    const smsResult = await sendGhlSms(ghlContactId, defaultMessage, settings.ghlKey);
    success = smsResult.ok;
    result = success ? "SMS sent" : `SMS failed: ${smsResult.error}`;
  } else if (action === "call" && phone && settings.blandKey) {
    const callResult = await triggerBlandCall(
      phone, name, settings.blandKey, settings.blandPathwayId, settings.aiCallingGreeting
    );
    success = callResult.ok;
    result = success ? `Call initiated (${callResult.callId})` : `Call failed: ${callResult.error}`;
  } else if (action === "email" && ghlContactId && settings.ghlKey) {
    const emailResult = await sendGhlEmail(
      ghlContactId,
      `Following up — ${name}`,
      `<p>${defaultMessage}</p>`,
      settings.ghlKey
    );
    success = emailResult.ok;
    result = success ? "Email sent" : `Email failed: ${emailResult.error}`;
  } else {
    result = `Skipped: missing ${action === "sms" ? "GHL contact ID or API key" : action === "call" ? "phone or Bland key" : "GHL contact ID or API key"}`;
  }

  const nextStep = step + 1;
  const sequence = ["sms", "call", "email"];
  const isComplete = nextStep >= maxAttempts || nextStep >= sequence.length;

  // Calculate next action time (2 days between touches)
  const nextActionAt = new Date();
  nextActionAt.setDate(nextActionAt.getDate() + 2);

  await supabase
    .from("follow_ups")
    .update({
      sequence_step: nextStep,
      stage: isComplete ? "completed" : "pending",
      next_action: isComplete ? action : sequence[nextStep] || "email",
      next_action_at: isComplete ? followUp.next_action_at : nextActionAt.toISOString(),
      last_action_at: new Date().toISOString(),
      last_action_type: action,
      last_action_result: result,
      updated_at: new Date().toISOString(),
    })
    .eq("id", followUp.id);

  return { action, result };
}

// POST: process all due follow-ups
export async function POST() {
  const supabase = createServiceClient();
  const settings = await getSettings(supabase);

  const { data: dueFollowUps, error } = await supabase
    .from("follow_ups")
    .select("*")
    .eq("stage", "pending")
    .lte("next_action_at", new Date().toISOString())
    .order("next_action_at")
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!dueFollowUps || dueFollowUps.length === 0) {
    return NextResponse.json({ processed: 0, message: "No follow-ups due" });
  }

  const results = [];
  for (const fu of dueFollowUps) {
    const r = await processFollowUp(fu, settings, supabase);
    results.push({ id: fu.id, name: fu.contact_name, ...r });
  }

  return NextResponse.json({ processed: results.length, results });
}

// GET: list all follow-ups
export async function GET() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("follow_ups")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ followUps: data });
}
