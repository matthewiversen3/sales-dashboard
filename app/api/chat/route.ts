import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServiceClient } from "@/lib/supabase";

const GHL_API_BASE = "https://services.leadconnectorhq.com";

// Tool definitions for Claude
const tools: Anthropic.Tool[] = [
  {
    name: "add_deal",
    description:
      "Add a new deal to the sales pipeline. Use this when a salesperson reports closing a sale or getting a new lead.",
    input_schema: {
      type: "object" as const,
      properties: {
        client_name: { type: "string", description: "Client/business name" },
        salesperson_name: {
          type: "string",
          description:
            "Name of the salesperson (e.g. Wayne, Josh, Matthew). If not specified, try to infer from context.",
        },
        product: {
          type: "string",
          enum: ["DFY Custom App Build", "DIY Custom App Build"],
          description: "Product sold",
        },
        payment_type: {
          type: "string",
          enum: [
            "PIF",
            "DEP",
            "Split",
            "Inhouse Fin",
            "Fin Payment",
            "10K Split 5/5",
            "9K Climb",
            "12K *",
          ],
          description:
            "Payment type. PIF = paid in full, DEP = deposit, Split = split payments, Inhouse Fin = in-house financing",
        },
        total_amount: { type: "number", description: "Total deal amount in dollars" },
        commission_pct: {
          type: "number",
          description: "Commission percentage, default 10",
        },
        close_date: {
          type: "string",
          description: "Close date in YYYY-MM-DD format. Default to today if not specified.",
        },
        stage: {
          type: "string",
          enum: ["lead", "proposal", "closed", "collecting", "paid"],
          description:
            "Pipeline stage. Use 'closed' if they just sold it, 'collecting' if payments are being collected, 'paid' if fully paid.",
        },
        lead_source: {
          type: "string",
          enum: [
            "Meta Ads",
            "Referral",
            "Cold Outreach",
            "Inbound",
            "GHL",
            "Other",
          ],
          description: "How the lead was acquired",
        },
        notes: {
          type: "string",
          description: "Any additional notes about the deal",
        },
      },
      required: ["client_name", "total_amount", "product", "stage"],
    },
  },
  {
    name: "create_payment_plan",
    description:
      "Create a custom payment plan for a deal. Use when the user describes specific payment amounts and dates.",
    input_schema: {
      type: "object" as const,
      properties: {
        deal_id: {
          type: "string",
          description: "The deal ID to create payments for",
        },
        payments: {
          type: "array",
          items: {
            type: "object",
            properties: {
              amount: { type: "number", description: "Payment amount" },
              due_date: {
                type: "string",
                description: "Due date YYYY-MM-DD",
              },
              label: {
                type: "string",
                description: "Label like 'Deposit', 'Month 1', etc.",
              },
            },
            required: ["amount", "due_date", "label"],
          },
          description: "Array of payment installments",
        },
      },
      required: ["deal_id", "payments"],
    },
  },
  {
    name: "update_deal",
    description:
      "Update an existing deal's stage, notes, or other fields. Use when user says they moved a deal forward, lost a deal, etc.",
    input_schema: {
      type: "object" as const,
      properties: {
        client_name: {
          type: "string",
          description: "Client name to find the deal",
        },
        stage: {
          type: "string",
          enum: ["lead", "proposal", "closed", "collecting", "paid"],
        },
        notes: { type: "string", description: "Updated notes" },
        total_amount: { type: "number" },
        payment_type: { type: "string" },
      },
      required: ["client_name"],
    },
  },
  {
    name: "verify_payment",
    description:
      "Mark a payment as collected/verified. Use when a salesperson confirms they collected a payment.",
    input_schema: {
      type: "object" as const,
      properties: {
        client_name: {
          type: "string",
          description: "Client name to find the deal",
        },
        payment_label: {
          type: "string",
          description:
            "Which payment to verify, e.g. 'Month 1', 'Deposit', 'Full Payment'",
        },
      },
      required: ["client_name"],
    },
  },
  {
    name: "update_ghl_tags",
    description:
      "Update tags on a contact in GoHighLevel CRM. Use after adding or updating a deal to keep GHL in sync.",
    input_schema: {
      type: "object" as const,
      properties: {
        contact_name: { type: "string", description: "Contact name in GHL" },
        tags: {
          type: "array",
          items: { type: "string" },
          description:
            "Tags to set, e.g. ['closed', 'dfy', 'pif'] or ['lead', 'meta-ads']",
        },
      },
      required: ["contact_name", "tags"],
    },
  },
  {
    name: "get_dashboard_summary",
    description:
      "Get a summary of the current dashboard state — deals, pipeline totals, outstanding payments, etc.",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "add_team_member",
    description: "Add a new salesperson to the team.",
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
            (s.name as string)
              .toLowerCase()
              .includes(
                (input.salesperson_name as string).toLowerCase()
              )
        );
        if (match) spId = match.id;
      }

      if (!spId) {
        return {
          result: "No salespeople found. Add a team member first.",
          actions,
        };
      }

      const { data: deal, error } = await supabase
        .from("deals")
        .insert({
          salesperson_id: spId,
          client_name: input.client_name,
          product: input.product || "DFY Custom App Build",
          payment_type: input.payment_type || "PIF",
          total_amount: input.total_amount,
          commission_pct: input.commission_pct || 10,
          commission_paid: 0,
          close_date: input.close_date || new Date().toISOString().split("T")[0],
          stage: input.stage || "closed",
          lead_source: input.lead_source || "Other",
          notes: input.notes || "",
          call_ids: [],
        })
        .select()
        .single();

      if (error)
        return { result: `Error creating deal: ${error.message}`, actions };

      actions.push(
        `Created deal: ${input.client_name} — $${input.total_amount}`
      );
      return {
        result: `Deal created successfully! ${input.client_name} for $${input.total_amount}. Deal ID: ${deal.id}. Stage: ${input.stage || "closed"}.`,
        actions,
      };
    }

    case "create_payment_plan": {
      const payments = input.payments as Array<{
        amount: number;
        due_date: string;
        label: string;
      }>;
      for (const p of payments) {
        await supabase.from("payments").insert({
          deal_id: input.deal_id,
          amount: p.amount,
          due_date: p.due_date,
          paid_date: null,
          verified: false,
          month_label: p.label,
        });
        actions.push(`Payment scheduled: ${p.label} — $${p.amount} due ${p.due_date}`);
      }

      // Also create reminders
      const { data: deal } = await supabase
        .from("deals")
        .select("salesperson_id")
        .eq("id", input.deal_id)
        .single();
      if (deal) {
        for (const p of payments) {
          const dueDate = new Date(p.due_date);
          const reminderDate = new Date(dueDate);
          reminderDate.setDate(reminderDate.getDate() - 3);
          // Get payment id
          const { data: pmtData } = await supabase
            .from("payments")
            .select("id")
            .eq("deal_id", input.deal_id)
            .eq("month_label", p.label)
            .single();
          if (pmtData) {
            await supabase.from("reminders").insert({
              payment_id: pmtData.id,
              salesperson_id: deal.salesperson_id,
              scheduled_for: reminderDate.toISOString(),
              sent_at: null,
              status: "pending",
            });
          }
        }
      }

      return {
        result: `Payment plan created with ${payments.length} installments. Reminders set for 3 days before each due date.`,
        actions,
      };
    }

    case "update_deal": {
      const { data: deals } = await supabase
        .from("deals")
        .select("*")
        .ilike("client_name", `%${input.client_name}%`);
      if (!deals || deals.length === 0) {
        return {
          result: `No deal found for "${input.client_name}"`,
          actions,
        };
      }
      const deal = deals[0];
      const updates: Record<string, unknown> = {};
      if (input.stage) updates.stage = input.stage;
      if (input.notes) updates.notes = input.notes;
      if (input.total_amount) updates.total_amount = input.total_amount;
      if (input.payment_type) updates.payment_type = input.payment_type;

      await supabase.from("deals").update(updates).eq("id", deal.id);
      actions.push(
        `Updated ${deal.client_name}: ${Object.entries(updates)
          .map(([k, v]) => `${k}=${v}`)
          .join(", ")}`
      );
      return { result: `Deal "${deal.client_name}" updated.`, actions };
    }

    case "verify_payment": {
      const { data: deals } = await supabase
        .from("deals")
        .select("id")
        .ilike("client_name", `%${input.client_name}%`);
      if (!deals || deals.length === 0) {
        return {
          result: `No deal found for "${input.client_name}"`,
          actions,
        };
      }

      const { data: payments } = await supabase
        .from("payments")
        .select("*")
        .eq("deal_id", deals[0].id)
        .eq("verified", false)
        .order("due_date");

      if (!payments || payments.length === 0) {
        return {
          result: `No outstanding payments for "${input.client_name}"`,
          actions,
        };
      }

      // Find matching payment by label or just take first unverified
      let payment = payments[0];
      if (input.payment_label) {
        const match = payments.find(
          (p: Record<string, unknown>) =>
            (p.month_label as string)
              .toLowerCase()
              .includes((input.payment_label as string).toLowerCase())
        );
        if (match) payment = match;
      }

      await supabase
        .from("payments")
        .update({
          verified: true,
          paid_date: new Date().toISOString().split("T")[0],
        })
        .eq("id", payment.id);
      actions.push(
        `Verified payment: ${payment.month_label} — $${payment.amount}`
      );
      return {
        result: `Payment verified: ${payment.month_label} ($${payment.amount}) for "${input.client_name}"`,
        actions,
      };
    }

    case "update_ghl_tags": {
      const { data: settings } = await supabase
        .from("app_settings")
        .select("*")
        .in("key", ["ghlApiKey", "ghlLocationId"]);

      const ghlKey = settings?.find(
        (s: Record<string, unknown>) => s.key === "ghlApiKey"
      )?.value;
      const ghlLocId = settings?.find(
        (s: Record<string, unknown>) => s.key === "ghlLocationId"
      )?.value;

      if (!ghlKey || !ghlLocId) {
        actions.push("GHL not configured — tags update skipped");
        return {
          result:
            "GHL API key or Location ID not configured. Skipping tag update. Set them in Settings.",
          actions,
        };
      }

      // Search for contact by name
      const searchRes = await fetch(
        `${GHL_API_BASE}/contacts/search/duplicate?locationId=${ghlLocId}&name=${encodeURIComponent(input.contact_name as string)}`,
        {
          headers: {
            Authorization: `Bearer ${ghlKey}`,
            Version: "2021-07-28",
          },
        }
      );

      if (!searchRes.ok) {
        actions.push(`GHL contact search failed (${searchRes.status})`);
        return {
          result: `Could not find contact "${input.contact_name}" in GHL (${searchRes.status})`,
          actions,
        };
      }

      const searchData = await searchRes.json();
      const contact = searchData.contact;

      if (!contact) {
        actions.push(`GHL contact "${input.contact_name}" not found`);
        return {
          result: `Contact "${input.contact_name}" not found in GHL. They may need to be added first.`,
          actions,
        };
      }

      // Update tags
      const updateRes = await fetch(
        `${GHL_API_BASE}/contacts/${contact.id}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${ghlKey}`,
            Version: "2021-07-28",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            tags: [
              ...(contact.tags || []),
              ...(input.tags as string[]),
            ],
          }),
        }
      );

      if (updateRes.ok) {
        actions.push(
          `Updated GHL tags for ${input.contact_name}: ${(input.tags as string[]).join(", ")}`
        );
        return {
          result: `GHL tags updated for "${input.contact_name}": ${(input.tags as string[]).join(", ")}`,
          actions,
        };
      } else {
        return {
          result: `Failed to update GHL tags (${updateRes.status})`,
          actions,
        };
      }
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

      const totalPipeline = deals.reduce(
        (s: number, d: Record<string, unknown>) =>
          s + Number(d.total_amount),
        0
      );
      const outstanding = payments
        .filter((p: Record<string, unknown>) => !p.verified)
        .reduce(
          (s: number, p: Record<string, unknown>) => s + Number(p.amount),
          0
        );
      const collected = payments
        .filter((p: Record<string, unknown>) => p.verified)
        .reduce(
          (s: number, p: Record<string, unknown>) => s + Number(p.amount),
          0
        );

      const byStage: Record<string, number> = {};
      for (const d of deals) {
        const stage = d.stage as string;
        byStage[stage] = (byStage[stage] || 0) + 1;
      }

      return {
        result: `Dashboard Summary:
- ${deals.length} deals, $${totalPipeline.toLocaleString()} total pipeline
- ${sps.length} team members
- $${collected.toLocaleString()} collected, $${outstanding.toLocaleString()} outstanding
- By stage: ${Object.entries(byStage)
            .map(([k, v]) => `${k}: ${v}`)
            .join(", ")}`,
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
      if (error)
        return {
          result: `Error adding team member: ${error.message}`,
          actions,
        };
      actions.push(`Added team member: ${input.name} (${input.role})`);
      return {
        result: `Added ${input.name} as ${input.role} to the team.`,
        actions,
      };
    }

    default:
      return { result: `Unknown tool: ${name}`, actions };
  }
}

export async function POST(req: NextRequest) {
  try {
    const { messages, apiKey } = await req.json();

    const anthropicKey =
      apiKey || process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      return NextResponse.json(
        {
          error:
            "No Anthropic API key. Add it in Settings or set ANTHROPIC_API_KEY env var.",
        },
        { status: 400 }
      );
    }

    const client = new Anthropic({ apiKey: anthropicKey });
    const supabase = createServiceClient();

    // Get current dashboard context
    const [dealsRes, spsRes] = await Promise.all([
      supabase.from("deals").select("id, client_name, stage, total_amount, payment_type, salesperson_id"),
      supabase.from("salespeople").select("id, name, role"),
    ]);

    const systemPrompt = `You are AppRabbit's AI sales assistant. You help the sales team manage their deals, payments, and pipeline through natural conversation.

Current team: ${(spsRes.data || []).map((s: Record<string, unknown>) => `${s.name} (${s.role})`).join(", ")}

Current deals: ${(dealsRes.data || [])
      .map(
        (d: Record<string, unknown>) =>
          `${d.client_name} — $${d.total_amount} (${d.stage}, ${d.payment_type})`
      )
      .join("; ")}

Today's date: ${new Date().toISOString().split("T")[0]}

Instructions:
- When a salesperson tells you about a sale, use add_deal to create it, then create_payment_plan if they describe a custom payment schedule, then update_ghl_tags to sync CRM.
- Be conversational and concise. Confirm what you did after each action.
- For payment plans, calculate dates automatically (e.g. "over the next 3 months" = monthly from today).
- Default commission is 10%. Default product is "DFY Custom App Build" unless they say DIY.
- If someone says "I sold" or "I closed", the stage should be "closed" or "collecting" depending on payment status.
- Always try to update GHL tags after creating/updating a deal.
- When inferring who the salesperson is, if they say "I", check if only one person is chatting. If ambiguous, ask.`;

    // Build messages for Claude
    const claudeMessages: Anthropic.MessageParam[] = messages.map(
      (m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })
    );

    let allActions: string[] = [];
    let finalResponse = "";

    // Agentic loop — keep calling Claude until no more tool_use
    let currentMessages = [...claudeMessages];
    for (let i = 0; i < 10; i++) {
      const response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: systemPrompt,
        tools,
        messages: currentMessages,
      });

      // Collect text and tool_use blocks
      const textBlocks = response.content.filter(
        (b) => b.type === "text"
      );
      const toolBlocks = response.content.filter(
        (b) => b.type === "tool_use"
      );

      if (toolBlocks.length === 0) {
        // No more tools — collect final text
        finalResponse = textBlocks.map((b) => {
          if (b.type === "text") return b.text;
          return "";
        }).join("");
        break;
      }

      // Execute tools
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of toolBlocks) {
        if (block.type === "tool_use") {
          const { result, actions } = await executeTool(
            block.name,
            block.input as Record<string, unknown>,
            supabase
          );
          allActions.push(...actions);
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: result,
          });
        }
      }

      // Append assistant response + tool results for next iteration
      currentMessages = [
        ...currentMessages,
        { role: "assistant", content: response.content },
        { role: "user", content: toolResults },
      ];

      // If stop_reason is "end_turn", grab text and break
      if (response.stop_reason === "end_turn") {
        finalResponse = textBlocks.map((b) => {
          if (b.type === "text") return b.text;
          return "";
        }).join("");
        break;
      }
    }

    // Save messages to DB
    await supabase.from("chat_messages").insert([
      {
        role: "user",
        content: messages[messages.length - 1].content,
      },
      {
        role: "assistant",
        content: finalResponse,
        actions_taken: allActions,
      },
    ]);

    return NextResponse.json({
      message: finalResponse,
      actions: allActions,
    });
  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Chat request failed",
      },
      { status: 500 }
    );
  }
}
