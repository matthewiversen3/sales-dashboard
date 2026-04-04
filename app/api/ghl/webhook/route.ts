import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

// GHL sends webhooks when new contacts are created
// This triggers an AI call via Bland.ai to qualify the lead
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const supabase = createServiceClient();

    // GHL webhook payload — extract contact info
    const contact = body.contact || body;
    const name =
      contact.contactName ||
      contact.contact_name ||
      [contact.firstName || contact.first_name, contact.lastName || contact.last_name]
        .filter(Boolean)
        .join(" ") ||
      "Unknown";
    const phone =
      contact.phone || contact.phoneNumber || contact.phone_number || "";
    const email = contact.email || "";
    const tags = contact.tags || [];

    if (!phone) {
      return NextResponse.json(
        { error: "No phone number on contact" },
        { status: 400 }
      );
    }

    // Check if AI calling is enabled
    const { data: settings } = await supabase
      .from("app_settings")
      .select("*")
      .in("key", ["aiCallingEnabled", "blandApiKey", "blandPathwayId", "aiCallingGreeting"]);

    const getSetting = (key: string) =>
      settings?.find((s: Record<string, unknown>) => s.key === key)?.value || "";

    const aiEnabled = getSetting("aiCallingEnabled") === "true";
    const blandKey = getSetting("blandApiKey");
    const pathwayId = getSetting("blandPathwayId");
    const greeting = getSetting("aiCallingGreeting");

    if (!aiEnabled) {
      return NextResponse.json({
        status: "skipped",
        reason: "AI calling is disabled",
      });
    }

    if (!blandKey) {
      return NextResponse.json(
        { error: "Bland.ai API key not configured" },
        { status: 400 }
      );
    }

    // Trigger AI call via Bland.ai
    const callPayload: Record<string, unknown> = {
      phone_number: phone,
      task: `You are calling ${name} from AppRabbit. They recently expressed interest in a custom mobile app for their business. Your goal is to:
1. Introduce yourself as a representative from AppRabbit
2. Confirm they're interested in a custom app
3. Learn about their business (what type, how many locations, current pain points)
4. Gauge their budget ($2K-$12K range for our products)
5. If interested, schedule a demo call with our sales team
Be friendly, professional, and concise. Don't be pushy.`,
      first_sentence: greeting || `Hi, is this ${name}? This is a call from AppRabbit regarding your interest in a custom mobile app.`,
      wait_for_greeting: true,
      model: "enhanced",
      language: "en",
      voice: "josh",
      max_duration: "5",
      record: true,
      metadata: {
        contact_name: name,
        contact_email: email,
        source: "ghl_webhook",
        tags: tags.join(","),
      },
    };

    // Use pathway if configured, otherwise use task-based calling
    if (pathwayId) {
      callPayload.pathway_id = pathwayId;
      delete callPayload.task;
    }

    const callRes = await fetch("https://api.bland.ai/v1/calls", {
      method: "POST",
      headers: {
        Authorization: blandKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(callPayload),
    });

    const callData = await callRes.json();

    if (!callRes.ok) {
      console.error("Bland.ai error:", callData);
      return NextResponse.json(
        {
          error: "Failed to initiate AI call",
          details: callData,
        },
        { status: 500 }
      );
    }

    // Log the call in our database
    // Find a default salesperson (first rep or founder)
    const { data: sps } = await supabase
      .from("salespeople")
      .select("id, role")
      .order("created_at");
    const defaultSp =
      sps?.find((s: Record<string, unknown>) => s.role === "rep") || sps?.[0];

    if (defaultSp) {
      await supabase.from("sales_calls").insert({
        title: `AI Call — ${name}`,
        date: new Date().toISOString(),
        duration: 0,
        participants: [name, "AI Agent"],
        salesperson_id: defaultSp.id,
        summary: `Automated AI call triggered by GHL webhook. Bland.ai call ID: ${callData.call_id || "unknown"}`,
        transcript: "",
        deal_id: null,
        source: "manual",
      });
    }

    return NextResponse.json({
      status: "call_initiated",
      call_id: callData.call_id,
      contact: name,
      phone,
    });
  } catch (error) {
    console.error("GHL webhook error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Webhook failed" },
      { status: 500 }
    );
  }
}
