/**
 * GHL New Lead Webhook
 *
 * Configure in GHL: Settings → Integrations → Webhooks → Add Webhook
 * URL: https://sales-dashboard-blush-kappa.vercel.app/api/webhooks/ghl
 * Events: Contact Created, Form Submitted
 *
 * When a new Facebook/Meta lead comes in, this:
 * 1. Creates a record in outreach_queue
 * 2. Generates a personalized AI draft message in Matt's voice
 * 3. The lead instantly appears in the AI Outreach page for approval
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import Anthropic from "@anthropic-ai/sdk";

const MATTS_VOICE_PROMPT = `You are writing text messages in Matt's voice for AppRabbit sales outreach.

Matt's texting style:
- Short, casual, direct. Max 2-3 sentences.
- Lowercase often, minimal punctuation
- Opens with their first name or a question
- Common phrases: "hey", "yo", "just wanted to check in", "lmk", "want to hop on a quick call?"
- Never corporate. Never "I hope this finds you well."
- Feels like a real person texting, not a salesperson

AppRabbit sells white-labeled fitness apps to gym owners and fitness professionals.

Write an intro message for a brand new lead. Keep it under 3 sentences. Ask if they're interested in building their own branded app.`;

async function generateDraftMessage(name: string, source: string): Promise<string> {
  try {
    const { data: keyRow } = await createServiceClient()
      .from("app_settings")
      .select("value")
      .eq("key", "anthropicApiKey")
      .single();

    if (!keyRow?.value) {
      return `hey ${name.split(" ")[0]}! just saw you reached out about AppRabbit — want to hop on a quick call to show you how it works?`;
    }

    const client = new Anthropic({ apiKey: keyRow.value });
    const firstName = name.split(" ")[0];
    const sourceNote = source ? ` (came in from ${source})` : "";

    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 150,
      messages: [{
        role: "user",
        content: `Write an intro text to ${firstName}${sourceNote} who just submitted a form about AppRabbit. Just the message text, nothing else.`
      }],
      system: MATTS_VOICE_PROMPT,
    });

    const content = msg.content[0];
    return content.type === "text" ? content.text.trim() : `hey ${firstName}! just saw your inquiry about AppRabbit — want to hop on a quick 15 min call?`;
  } catch {
    const firstName = name.split(" ")[0];
    return `hey ${firstName}! just saw you reached out about AppRabbit — want to hop on a quick call to show you what we do?`;
  }
}

export async function POST(req: NextRequest) {
  const supabase = createServiceClient();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // GHL sends different payload shapes depending on trigger
  // Handle both "Contact Created" and "Form Submitted" events
  const contactName =
    (body.contact_name as string) ||
    `${body.first_name || ""} ${body.last_name || ""}`.trim() ||
    (body.name as string) ||
    "New Lead";

  const phone =
    (body.phone as string) ||
    (body.phone_raw as string) ||
    (body.contact?.phone as string) ||
    null;

  const ghlContactId =
    (body.contact_id as string) ||
    (body.id as string) ||
    (body.contact?.id as string) ||
    null;

  const source =
    (body.source as string) ||
    (body.attribution_source as string) ||
    "GHL";

  // Determine temperature — new leads are always Hot
  const temperature = "hot";

  // Generate AI draft message
  const draftMessage = await generateDraftMessage(contactName, source);

  // Insert into outreach_queue
  const { error } = await supabase
    .from("outreach_queue")
    .insert({
      contact_name: contactName,
      phone,
      temperature,
      pipeline_stage: "New Lead",
      draft_message: draftMessage,
      last_message: null,
      last_sender: null,
      days_since: 0,
      status: "pending_review",
      source: "ghl_webhook",
      ghl_contact_id: ghlContactId,
    });

  if (error) {
    console.error("Failed to insert outreach lead:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Also create a follow_up sequence (automated SMS → Call → Email backup)
  if (ghlContactId) {
    const followUpAt = new Date();
    followUpAt.setHours(followUpAt.getHours() + 24); // Start sequence in 24h if not manually contacted

    await supabase.from("follow_ups").insert({
      contact_name: contactName,
      contact_phone: phone,
      ghl_contact_id: ghlContactId,
      stage: "pending",
      sequence_step: 0,
      next_action: "sms",
      next_action_at: followUpAt.toISOString(),
      max_attempts: 3,
      message_template: draftMessage,
      notes: `Auto-created from GHL webhook. Source: ${source}`,
    });
  }

  return NextResponse.json({ ok: true, contact: contactName });
}

// GET: confirm webhook is live (GHL pings this to verify)
export async function GET() {
  return NextResponse.json({ status: "AppRabbit GHL webhook active", ts: new Date().toISOString() });
}
