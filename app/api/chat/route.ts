import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServiceClient } from "@/lib/supabase";

const GHL_API_BASE = "https://services.leadconnectorhq.com";

// Helper: get GHL credentials from settings
async function getGhlCreds(supabase: ReturnType<typeof createServiceClient>) {
  const { data } = await supabase
    .from("app_settings")
    .select("*")
    .in("key", ["ghlApiKey", "ghlLocationId"]);
  const ghlKey = data?.find((s: Record<string, unknown>) => s.key === "ghlApiKey")?.value;
  const ghlLocId = data?.find((s: Record<string, unknown>) => s.key === "ghlLocationId")?.value;
  return { ghlKey, ghlLocId };
}

// Helper: search GHL contact by name
async function findGhlContact(name: string, ghlKey: string, ghlLocId: string) {
  try {
    const res = await fetch(
      `${GHL_API_BASE}/contacts/search/duplicate?locationId=${ghlLocId}&name=${encodeURIComponent(name)}`,
      {
        headers: {
          Authorization: `Bearer ${ghlKey}`,
          Version: "2021-07-28",
        },
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.contact || null;
  } catch {
    return null;
  }
}

// Helper: update GHL contact tags
async function updateGhlContact(
  contactId: string,
  existingTags: string[],
  newTags: string[],
  ghlKey: string
) {
  const allTags = [...new Set([...existingTags, ...newTags])];
  try {
    const res = await fetch(`${GHL_API_BASE}/contacts/${contactId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${ghlKey}`,
        Version: "2021-07-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ tags: allTags }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Map dashboard stage to GHL tags
function stageToGhlTags(stage: string, paymentType: string): string[] {
  const tags: string[] = [];
  switch (stage) {
    case "lead":
      tags.push("lead");
      break;
    case "proposal":
      tags.push("proposal");
      break;
    case "closed":
      tags.push("closed", "won");
      break;
    case "collecting":
      tags.push("closed", "won", "collecting");
      break;
    case "paid":
      tags.push("closed", "won", "paid");
      break;
  }
  if (paymentType) tags.push(paymentType.toLowerCase().replace(/\s+/g, "-"));
  return tags;
}

// Tool definitions for Claude
const tools: Anthropic.Tool[] = [
  {
    name: "add_deal",
    description:
      "Add a new deal to the sales pipeline AND automatically update the contact in GoHighLevel with the right tags and pipeline stage. Use when a salesperson reports a sale or new lead.",
    input_schema: {
      type: "object" as const,
      properties: {
        client_name: { type: "string", description: "Client/business name" },
        salesperson_name: {
          type: "string",
          description: "Name of the salesperson. If the user says 'I', infer from context or default to Matthew.",
        },
        product: {
          type: "string",
          enum: ["DFY Custom App Build", "DIY Custom App Build"],
        },
        payment_type: {
          type: "string",
          enum: ["PIF", "DEP", "Split", "Inhouse Fin", "Fin Payment", "10K Split 5/5", "9K Climb", "12K *"],
          description: "PIF = paid in full. If they mention paying over time, use 'Inhouse Fin' or 'Split'.",
        },
        total_amount: { type: "number", description: "Total deal amount in dollars" },
        initial_payment: {
          type: "number",
          description: "Amount paid today/upfront, if mentioned. The rest will be split into the payment plan.",
        },
        remaining_months: {
          type: "number",
          description: "Number of months to split the remaining balance over, if mentioned.",
        },
        commission_pct: { type: "number", description: "Commission %, default 10" },
        close_date: { type: "string", description: "YYYY-MM-DD. Default today." },
        stage: {
          type: "string",
          enum: ["lead", "proposal", "closed", "collecting", "paid"],
          description: "Use 'closed' if just sold. 'collecting' if there's a payment plan. 'paid' if fully paid.",
        },
        lead_source: {
          type: "string",
          enum: ["Meta Ads", "Referral", "Cold Outreach", "Inbound", "GHL", "Other"],
        },
        notes: { type: "string" },
      },
      required: ["client_name", "total_amount", "product", "stage"],
    },
  },
  {
    name: "update_deal",
    description: "Update an existing deal and sync the change to GHL.",
    input_schema: {
      type: "object" as const,
      properties: {
        client_name: { type: "string", description: "Client name to find the deal" },
        stage: { type: "string", enum: ["lead", "proposal", "closed", "collecting", "paid"] },
        notes: { type: "string" },
        total_amount: { type: "number" },
        payment_type: { type: "string" },
      },
      required: ["client_name"],
    },
  },
  {
    name: "verify_payment",
    description: "Mark a payment as collected/verified.",
    input_schema: {
      type: "object" as const,
      properties: {
        client_name: { type: "string" },
        payment_label: { type: "string", description: "e.g. 'Month 1', 'Deposit', 'Full Payment'. If not specified, verifies the next unpaid one." },
      },
      required: ["client_name"],
    },
  },
  {
    name: "get_dashboard_summary",
    description: "Get current pipeline stats, deal counts, outstanding payments.",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "add_team_member",
    description: "Add a new salesperson.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string" },
        phone: { type: "string" },
        email: { type: "string" },
        role: { type: "string", enum: ["rep", "setter", "founder"] },
      },
      required: ["name", "role"],
    },
  },
  {
    name: "queue_follow_ups",
    description:
      "Queue AI follow-ups for contacts. Can target specific people or all contacts in a stage. Uses a 3-touch sequence: SMS (day 0) → AI Call (day 2) → Email (day 4).",
    input_schema: {
      type: "object" as const,
      properties: {
        stage: {
          type: "string",
          enum: ["lead", "proposal", "closed", "collecting"],
          description: "Target all contacts in this pipeline stage for follow-up",
        },
        client_name: {
          type: "string",
          description: "Follow up with a specific client by name",
        },
        message: {
          type: "string",
          description: "Custom follow-up message. If not provided, a default is used.",
        },
      },
    },
  },
  {
    name: "list_follow_ups",
    description: "Show active/pending follow-ups and their status.",
    input_schema: {
      type: "object" as const,
      properties: {
        stage: {
          type: "string",
          enum: ["pending", "completed", "paused"],
          description: "Filter by follow-up status. Default: pending",
        },
      },
    },
  },
  {
    name: "pause_follow_up",
    description: "Pause or cancel a follow-up for a specific contact.",
    input_schema: {
      type: "object" as const,
      properties: {
        client_name: { type: "string", description: "Contact name to pause follow-ups for" },
      },
      required: ["client_name"],
    },
  },
];

// Execute tool calls
async function executeTool(
  name: string,
  input: Record<string, unknown>,
  supabase: ReturnType<typeof createServiceClient>
): Promise<{ result: string; actions: string[] }> {
  const actions: string[] = [];

  switch (name) {
    case "add_deal": {
      // Find salesperson
      const { data: sps } = await supabase.from("salespeople").select("*");
      let spId = sps?.[0]?.id;
      if (input.salesperson_name) {
        const match = sps?.find(
          (s: Record<string, unknown>) =>
            (s.name as string).toLowerCase().includes((input.salesperson_name as string).toLowerCase())
        );
        if (match) spId = match.id;
      }
      if (!spId) return { result: "No salespeople found. Add a team member first.", actions };

      const stage = (input.stage as string) || "closed";
      const paymentType = (input.payment_type as string) || "PIF";
      const totalAmount = input.total_amount as number;
      const closeDate = (input.close_date as string) || new Date().toISOString().split("T")[0];

      // Create the deal
      const { data: deal, error } = await supabase
        .from("deals")
        .insert({
          salesperson_id: spId,
          client_name: input.client_name,
          product: input.product || "DFY Custom App Build",
          payment_type: paymentType,
          total_amount: totalAmount,
          commission_pct: input.commission_pct || 10,
          commission_paid: 0,
          close_date: closeDate,
          stage,
          lead_source: input.lead_source || "Other",
          notes: input.notes || "",
          call_ids: [],
        })
        .select()
        .single();

      if (error) return { result: `Error creating deal: ${error.message}`, actions };
      actions.push(`Created deal: ${input.client_name} — $${totalAmount}`);

      // Auto-create payment plan if there's an initial payment + remaining months
      const initialPayment = input.initial_payment as number | undefined;
      const remainingMonths = input.remaining_months as number | undefined;

      if (initialPayment && remainingMonths && remainingMonths > 0) {
        const remaining = totalAmount - initialPayment;
        const monthlyAmount = Math.round((remaining / remainingMonths) * 100) / 100;

        // Initial payment (verified today)
        const { data: initPmt } = await supabase.from("payments").insert({
          deal_id: deal.id,
          amount: initialPayment,
          due_date: closeDate,
          paid_date: closeDate,
          verified: true,
          month_label: "Initial Payment",
        }).select().single();
        actions.push(`Payment: Initial $${initialPayment} — paid today`);

        // Monthly payments
        const spIdForReminder = spId;
        for (let i = 1; i <= remainingMonths; i++) {
          const dueDate = new Date(closeDate);
          dueDate.setMonth(dueDate.getMonth() + i);
          const amt = i === remainingMonths ? remaining - monthlyAmount * (remainingMonths - 1) : monthlyAmount;

          const { data: pmt } = await supabase.from("payments").insert({
            deal_id: deal.id,
            amount: amt,
            due_date: dueDate.toISOString().split("T")[0],
            paid_date: null,
            verified: false,
            month_label: `Month ${i}`,
          }).select().single();
          actions.push(`Payment: Month ${i} — $${amt.toFixed(2)} due ${dueDate.toISOString().split("T")[0]}`);

          // Create reminder 3 days before
          if (pmt) {
            const reminderDate = new Date(dueDate);
            reminderDate.setDate(reminderDate.getDate() - 3);
            await supabase.from("reminders").insert({
              payment_id: pmt.id,
              salesperson_id: spIdForReminder,
              scheduled_for: reminderDate.toISOString(),
              sent_at: null,
              status: "pending",
            });
          }
        }
        actions.push(`Reminders set for 3 days before each payment`);
      } else if (stage !== "lead" && stage !== "proposal" && totalAmount > 0) {
        // Default payment schedule based on payment type
        // PIF = one payment, Split = 2, Inhouse Fin = 3
        let installments = 1;
        if (paymentType === "Split" || paymentType === "10K Split 5/5" || paymentType === "DEP") installments = 2;
        else if (paymentType === "Inhouse Fin" || paymentType === "Fin Payment" || paymentType === "9K Climb" || paymentType === "12K *") installments = 3;

        const perPayment = Math.round((totalAmount / installments) * 100) / 100;
        for (let i = 0; i < installments; i++) {
          const dueDate = new Date(closeDate);
          dueDate.setMonth(dueDate.getMonth() + i);
          const amt = i === installments - 1 ? totalAmount - perPayment * (installments - 1) : perPayment;
          const label = installments === 1 ? "Full Payment" : i === 0 && paymentType === "DEP" ? "Deposit" : `Month ${i + 1}`;

          const { data: pmt } = await supabase.from("payments").insert({
            deal_id: deal.id,
            amount: amt,
            due_date: dueDate.toISOString().split("T")[0],
            paid_date: null,
            verified: false,
            month_label: label,
          }).select().single();

          if (pmt && installments > 1) {
            const reminderDate = new Date(dueDate);
            reminderDate.setDate(reminderDate.getDate() - 3);
            await supabase.from("reminders").insert({
              payment_id: pmt.id,
              salesperson_id: spId,
              scheduled_for: reminderDate.toISOString(),
              sent_at: null,
              status: "pending",
            });
          }
        }
        actions.push(`Payment schedule created (${installments} installment${installments > 1 ? "s" : ""})`);
      }

      // Auto-update GHL
      const { ghlKey, ghlLocId } = await getGhlCreds(supabase);
      if (ghlKey && ghlLocId) {
        const contact = await findGhlContact(input.client_name as string, ghlKey, ghlLocId);
        if (contact) {
          const ghlTags = stageToGhlTags(stage, paymentType);
          const ok = await updateGhlContact(contact.id, contact.tags || [], ghlTags, ghlKey);
          if (ok) {
            actions.push(`GHL updated: ${input.client_name} tagged [${ghlTags.join(", ")}]`);
          } else {
            actions.push(`GHL tag update failed for ${input.client_name}`);
          }
        } else {
          actions.push(`GHL: "${input.client_name}" not found in contacts — add them in GHL to sync`);
        }
      }

      const spName = sps?.find((s: Record<string, unknown>) => s.id === spId)?.name || "Unknown";
      return {
        result: `Deal created: ${input.client_name} — $${totalAmount} (${stage}). Assigned to ${spName}. Deal ID: ${deal.id}.${initialPayment ? ` Payment plan: $${initialPayment} today + $${(totalAmount - initialPayment).toFixed(2)} over ${remainingMonths} months.` : ""}`,
        actions,
      };
    }

    case "update_deal": {
      const { data: deals } = await supabase
        .from("deals")
        .select("*")
        .ilike("client_name", `%${input.client_name}%`);
      if (!deals || deals.length === 0)
        return { result: `No deal found for "${input.client_name}"`, actions };

      const deal = deals[0];
      const updates: Record<string, unknown> = {};
      if (input.stage) updates.stage = input.stage;
      if (input.notes) updates.notes = input.notes;
      if (input.total_amount) updates.total_amount = input.total_amount;
      if (input.payment_type) updates.payment_type = input.payment_type;

      await supabase.from("deals").update(updates).eq("id", deal.id);
      actions.push(`Updated ${deal.client_name}: ${Object.entries(updates).map(([k, v]) => `${k}=${v}`).join(", ")}`);

      // Sync to GHL
      const { ghlKey, ghlLocId } = await getGhlCreds(supabase);
      if (ghlKey && ghlLocId) {
        const contact = await findGhlContact(deal.client_name, ghlKey, ghlLocId);
        if (contact) {
          const newStage = (input.stage as string) || (deal.stage as string);
          const ghlTags = stageToGhlTags(newStage, (input.payment_type as string) || (deal.payment_type as string));
          const ok = await updateGhlContact(contact.id, contact.tags || [], ghlTags, ghlKey);
          if (ok) actions.push(`GHL updated: ${deal.client_name} tagged [${ghlTags.join(", ")}]`);
        }
      }

      return { result: `Deal "${deal.client_name}" updated.`, actions };
    }

    case "verify_payment": {
      const { data: deals } = await supabase
        .from("deals")
        .select("id, client_name")
        .ilike("client_name", `%${input.client_name}%`);
      if (!deals || deals.length === 0)
        return { result: `No deal found for "${input.client_name}"`, actions };

      const { data: payments } = await supabase
        .from("payments")
        .select("*")
        .eq("deal_id", deals[0].id)
        .eq("verified", false)
        .order("due_date");

      if (!payments || payments.length === 0)
        return { result: `No outstanding payments for "${input.client_name}"`, actions };

      let payment = payments[0];
      if (input.payment_label) {
        const match = payments.find(
          (p: Record<string, unknown>) =>
            (p.month_label as string).toLowerCase().includes((input.payment_label as string).toLowerCase())
        );
        if (match) payment = match;
      }

      await supabase
        .from("payments")
        .update({ verified: true, paid_date: new Date().toISOString().split("T")[0] })
        .eq("id", payment.id);
      actions.push(`Verified: ${payment.month_label} — $${payment.amount} for ${deals[0].client_name}`);

      // Check if all payments are now verified → move to "paid"
      const { data: remaining } = await supabase
        .from("payments")
        .select("id")
        .eq("deal_id", deals[0].id)
        .eq("verified", false);
      if (remaining && remaining.length === 0) {
        await supabase.from("deals").update({ stage: "paid" }).eq("id", deals[0].id);
        actions.push(`All payments collected — ${deals[0].client_name} moved to Paid`);

        // Update GHL
        const { ghlKey, ghlLocId } = await getGhlCreds(supabase);
        if (ghlKey && ghlLocId) {
          const contact = await findGhlContact(deals[0].client_name, ghlKey, ghlLocId);
          if (contact) {
            await updateGhlContact(contact.id, contact.tags || [], ["paid", "closed", "won"], ghlKey);
            actions.push(`GHL updated: ${deals[0].client_name} tagged [paid]`);
          }
        }
      }

      return {
        result: `Payment verified: ${payment.month_label} ($${payment.amount}) for "${deals[0].client_name}". ${remaining?.length || 0} payments remaining.`,
        actions,
      };
    }

    case "get_dashboard_summary": {
      const [dealsRes, paymentsRes, spsRes] = await Promise.all([
        supabase.from("deals").select("*"),
        supabase.from("payments").select("*"),
        supabase.from("salespeople").select("*"),
      ]);

      const deals = dealsRes.data || [];
      const payments = paymentsRes.data || [];
      const sps = spsRes.data || [];

      const totalPipeline = deals.reduce((s: number, d: Record<string, unknown>) => s + Number(d.total_amount), 0);
      const outstanding = payments.filter((p: Record<string, unknown>) => !p.verified).reduce((s: number, p: Record<string, unknown>) => s + Number(p.amount), 0);
      const collected = payments.filter((p: Record<string, unknown>) => p.verified).reduce((s: number, p: Record<string, unknown>) => s + Number(p.amount), 0);

      const byStage: Record<string, number> = {};
      for (const d of deals) byStage[d.stage as string] = (byStage[d.stage as string] || 0) + 1;

      return {
        result: `Dashboard Summary:\n- ${deals.length} deals, $${totalPipeline.toLocaleString()} total pipeline\n- ${sps.length} team members\n- $${collected.toLocaleString()} collected, $${outstanding.toLocaleString()} outstanding\n- By stage: ${Object.entries(byStage).map(([k, v]) => `${k}: ${v}`).join(", ")}`,
        actions,
      };
    }

    case "add_team_member": {
      const { error } = await supabase.from("salespeople").insert({
        name: input.name,
        phone: input.phone || "",
        email: input.email || "",
        role: input.role || "rep",
      });
      if (error) return { result: `Error: ${error.message}`, actions };
      actions.push(`Added team member: ${input.name} (${input.role})`);
      return { result: `Added ${input.name} as ${input.role}.`, actions };
    }

    case "queue_follow_ups": {
      const targetStage = input.stage as string | undefined;
      const targetName = input.client_name as string | undefined;
      const customMessage = input.message as string | undefined;

      let contacts: { name: string; dealId: string; phone?: string; email?: string }[] = [];

      if (targetName) {
        // Find specific deal
        const { data: deals } = await supabase
          .from("deals")
          .select("id, client_name")
          .ilike("client_name", `%${targetName}%`);
        if (deals && deals.length > 0) {
          contacts = deals.map((d: Record<string, unknown>) => ({
            name: d.client_name as string,
            dealId: d.id as string,
          }));
        }
      } else if (targetStage) {
        // Find all deals in that stage
        const { data: deals } = await supabase
          .from("deals")
          .select("id, client_name")
          .eq("stage", targetStage);
        if (deals) {
          contacts = deals.map((d: Record<string, unknown>) => ({
            name: d.client_name as string,
            dealId: d.id as string,
          }));
        }
      }

      if (contacts.length === 0) {
        return { result: `No contacts found${targetStage ? ` in "${targetStage}" stage` : ` matching "${targetName}"`}.`, actions };
      }

      // Look up GHL contacts for phone/email/contactId
      const { ghlKey, ghlLocId } = await getGhlCreds(supabase);
      let queued = 0;

      for (const contact of contacts) {
        let ghlContactId = "";
        let phone = "";
        let email = "";

        if (ghlKey && ghlLocId) {
          const ghlContact = await findGhlContact(contact.name, ghlKey, ghlLocId);
          if (ghlContact) {
            ghlContactId = ghlContact.id;
            phone = ghlContact.phone || "";
            email = ghlContact.email || "";
          }
        }

        // Check if already has a pending follow-up
        const { data: existing } = await supabase
          .from("follow_ups")
          .select("id")
          .eq("contact_name", contact.name)
          .eq("stage", "pending")
          .limit(1);

        if (existing && existing.length > 0) continue;

        await supabase.from("follow_ups").insert({
          deal_id: contact.dealId,
          contact_name: contact.name,
          contact_phone: phone,
          contact_email: email,
          ghl_contact_id: ghlContactId,
          stage: "pending",
          sequence_step: 0,
          next_action: "sms",
          next_action_at: new Date().toISOString(),
          max_attempts: 3,
          message_template: customMessage || null,
        });
        queued++;
      }

      actions.push(`Queued ${queued} follow-up${queued !== 1 ? "s" : ""} (SMS → Call → Email sequence)`);
      return {
        result: `Queued ${queued} follow-up${queued !== 1 ? "s" : ""} for ${targetStage ? `all "${targetStage}" contacts` : `"${targetName}"`}. Sequence: SMS today → AI Call in 2 days → Email in 4 days.`,
        actions,
      };
    }

    case "list_follow_ups": {
      const filterStage = (input.stage as string) || "pending";
      const { data: followUps } = await supabase
        .from("follow_ups")
        .select("*")
        .eq("stage", filterStage)
        .order("next_action_at");

      if (!followUps || followUps.length === 0) {
        return { result: `No ${filterStage} follow-ups.`, actions };
      }

      const list = followUps.map((fu: Record<string, unknown>) => {
        const step = fu.sequence_step as number;
        const nextAction = fu.next_action as string;
        const nextAt = new Date(fu.next_action_at as string).toLocaleDateString();
        const lastResult = fu.last_action_result as string;
        return `• ${fu.contact_name}: step ${step}/3, next: ${nextAction} on ${nextAt}${lastResult ? ` (last: ${lastResult})` : ""}`;
      }).join("\n");

      return { result: `${filterStage.charAt(0).toUpperCase() + filterStage.slice(1)} follow-ups (${followUps.length}):\n${list}`, actions };
    }

    case "pause_follow_up": {
      const { data: followUps } = await supabase
        .from("follow_ups")
        .select("id, contact_name")
        .ilike("contact_name", `%${input.client_name}%`)
        .eq("stage", "pending");

      if (!followUps || followUps.length === 0) {
        return { result: `No pending follow-ups for "${input.client_name}".`, actions };
      }

      for (const fu of followUps) {
        await supabase.from("follow_ups").update({ stage: "paused", updated_at: new Date().toISOString() }).eq("id", fu.id);
      }

      actions.push(`Paused ${followUps.length} follow-up${followUps.length !== 1 ? "s" : ""} for ${followUps[0].contact_name}`);
      return { result: `Paused follow-ups for "${followUps[0].contact_name}".`, actions };
    }

    default:
      return { result: `Unknown tool: ${name}`, actions };
  }
}

export async function POST(req: NextRequest) {
  try {
    const { messages, apiKey } = await req.json();
    const supabase = createServiceClient();

    // Get Anthropic key: request body → Supabase settings → env var
    let anthropicKey = apiKey || process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      const { data: keyRow } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "anthropicApiKey")
        .single();
      if (keyRow?.value) anthropicKey = keyRow.value;
    }

    if (!anthropicKey) {
      return NextResponse.json(
        { error: "No Anthropic API key. Add it in Settings → AI Chat Assistant." },
        { status: 400 }
      );
    }

    const client = new Anthropic({ apiKey: anthropicKey });

    // Get current dashboard context
    const [dealsRes, spsRes, paymentsRes] = await Promise.all([
      supabase.from("deals").select("id, client_name, stage, total_amount, payment_type, salesperson_id"),
      supabase.from("salespeople").select("id, name, role"),
      supabase.from("payments").select("deal_id, amount, verified, month_label").eq("verified", false).order("due_date").limit(10),
    ]);

    const teamStr = (spsRes.data || []).map((s: Record<string, unknown>) => `${s.name} (${s.role}, id:${s.id})`).join(", ");
    const dealsStr = (dealsRes.data || []).map((d: Record<string, unknown>) => `${d.client_name} — $${d.total_amount} (${d.stage}, ${d.payment_type})`).join("; ");
    const outstandingStr = (paymentsRes.data || []).map((p: Record<string, unknown>) => {
      const deal = (dealsRes.data || []).find((d: Record<string, unknown>) => d.id === p.deal_id);
      return `${(deal as Record<string, unknown>)?.client_name || "?"}: ${p.month_label} $${p.amount}`;
    }).join("; ");

    const systemPrompt = `You are AppRabbit's AI sales assistant. You update the dashboard and GHL CRM through conversation.

TEAM: ${teamStr}
DEALS: ${dealsStr}
OUTSTANDING PAYMENTS: ${outstandingStr}
TODAY: ${new Date().toISOString().split("T")[0]}

RULES:
1. When someone says "I sold/closed X", ALWAYS use add_deal. If they say "I", default to Matthew (founder) unless context says otherwise.
2. If they mention payments over time (e.g. "$1K today, rest over 3 months"), set initial_payment and remaining_months on add_deal. This auto-creates the full payment plan with reminders.
3. EVERY add_deal and update_deal automatically syncs to GHL — tags are set based on pipeline stage (lead, proposal, closed/won, collecting, paid).
4. If someone says "mark X as paid" or "collected payment from X", use verify_payment.
5. Be brief and confirm actions. Show what you did.
6. Default product is "DFY Custom App Build". Default commission is 10%.
7. For payment type: if they mention installments/months, use "Inhouse Fin". If split in 2, use "Split". If paid in full, use "PIF".
8. FOLLOW-UPS: When someone says "follow up with X" or "reach out to all leads/proposals", use queue_follow_ups. This queues a 3-touch AI sequence: SMS (immediate) → AI Phone Call (day 2) → Email (day 4).
9. Use list_follow_ups to show current follow-up status. Use pause_follow_up to stop following up with someone (e.g. "don't call Jorge, he's on vacation").`;

    const claudeMessages: Anthropic.MessageParam[] = messages.map(
      (m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })
    );

    let allActions: string[] = [];
    let finalResponse = "";
    let currentMessages = [...claudeMessages];

    // Agentic loop
    for (let i = 0; i < 10; i++) {
      const response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: systemPrompt,
        tools,
        messages: currentMessages,
      });

      const textBlocks = response.content.filter((b) => b.type === "text");
      const toolBlocks = response.content.filter((b) => b.type === "tool_use");

      if (toolBlocks.length === 0) {
        finalResponse = textBlocks.map((b) => (b.type === "text" ? b.text : "")).join("");
        break;
      }

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of toolBlocks) {
        if (block.type === "tool_use") {
          const { result, actions } = await executeTool(block.name, block.input as Record<string, unknown>, supabase);
          allActions.push(...actions);
          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
        }
      }

      currentMessages = [
        ...currentMessages,
        { role: "assistant", content: response.content },
        { role: "user", content: toolResults },
      ];

      if (response.stop_reason === "end_turn") {
        finalResponse = textBlocks.map((b) => (b.type === "text" ? b.text : "")).join("");
        break;
      }
    }

    // Save to chat history
    await supabase.from("chat_messages").insert([
      { role: "user", content: messages[messages.length - 1].content },
      { role: "assistant", content: finalResponse, actions_taken: allActions },
    ]);

    return NextResponse.json({ message: finalResponse, actions: allActions });
  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Chat request failed" },
      { status: 500 }
    );
  }
}
