import { supabase } from "./supabase";
import { Deal, Payment, PipelineStage, Reminder, SalesCall, Salesperson } from "./types";

export interface AppSettings {
  tldvApiKey: string;
  tldvLastSync: string | null;
  ghlApiKey: string;
  ghlLocationId: string;
  ghlLastSync: string | null;
}

export interface StoreData {
  salespeople: Salesperson[];
  deals: Deal[];
  payments: Payment[];
  reminders: Reminder[];
  calls: SalesCall[];
  settings: AppSettings;
}

const defaultSettings: AppSettings = {
  tldvApiKey: "",
  tldvLastSync: null,
  ghlApiKey: "",
  ghlLocationId: "",
  ghlLastSync: null,
};

// ── Helpers: map DB rows (snake_case) ↔ app objects (camelCase) ──

function rowToSalesperson(r: Record<string, unknown>): Salesperson {
  return {
    id: r.id as string,
    name: r.name as string,
    phone: r.phone as string,
    email: r.email as string,
    role: r.role as Salesperson["role"],
    createdAt: r.created_at as string,
  };
}

function rowToDeal(r: Record<string, unknown>): Deal {
  return {
    id: r.id as string,
    salespersonId: r.salesperson_id as string,
    clientName: r.client_name as string,
    product: r.product as Deal["product"],
    paymentType: r.payment_type as Deal["paymentType"],
    totalAmount: Number(r.total_amount),
    commissionPct: Number(r.commission_pct),
    commissionPaid: Number(r.commission_paid),
    closeDate: r.close_date as string,
    stage: r.stage as PipelineStage,
    leadSource: r.lead_source as Deal["leadSource"],
    setterId: (r.setter_id as string) || null,
    notes: r.notes as string,
    callIds: (r.call_ids as string[]) || [],
    createdAt: r.created_at as string,
  };
}

function rowToPayment(r: Record<string, unknown>): Payment {
  return {
    id: r.id as string,
    dealId: r.deal_id as string,
    amount: Number(r.amount),
    dueDate: r.due_date as string,
    paidDate: (r.paid_date as string) || null,
    verified: r.verified as boolean,
    monthLabel: r.month_label as string,
    createdAt: r.created_at as string,
  };
}

function rowToReminder(r: Record<string, unknown>): Reminder {
  return {
    id: r.id as string,
    paymentId: r.payment_id as string,
    salespersonId: r.salesperson_id as string,
    scheduledFor: r.scheduled_for as string,
    sentAt: (r.sent_at as string) || null,
    status: r.status as Reminder["status"],
  };
}

function rowToCall(r: Record<string, unknown>): SalesCall {
  return {
    id: r.id as string,
    title: r.title as string,
    date: r.date as string,
    duration: Number(r.duration),
    participants: (r.participants as string[]) || [],
    salespersonId: r.salesperson_id as string,
    summary: r.summary as string,
    transcript: r.transcript as string,
    dealId: (r.deal_id as string) || null,
    source: r.source as SalesCall["source"],
    createdAt: r.created_at as string,
  };
}

// ── Fetch all data (replaces old synchronous getData) ──

export async function getData(): Promise<StoreData> {
  const [spRes, dealsRes, payRes, remRes, callsRes, settingsRes] = await Promise.all([
    supabase.from("salespeople").select("*").order("created_at"),
    supabase.from("deals").select("*").order("created_at"),
    supabase.from("payments").select("*").order("due_date"),
    supabase.from("reminders").select("*").order("scheduled_for"),
    supabase.from("sales_calls").select("*").order("date", { ascending: false }),
    supabase.from("app_settings").select("*"),
  ]);

  const settings: AppSettings = { ...defaultSettings };
  for (const row of settingsRes.data || []) {
    const k = row.key as keyof AppSettings;
    if (k in settings) {
      (settings as unknown as Record<string, unknown>)[k] = row.value || (k.endsWith("Sync") ? null : "");
    }
  }

  return {
    salespeople: (spRes.data || []).map(rowToSalesperson),
    deals: (dealsRes.data || []).map(rowToDeal),
    payments: (payRes.data || []).map(rowToPayment),
    reminders: (remRes.data || []).map(rowToReminder),
    calls: (callsRes.data || []).map(rowToCall),
    settings,
  };
}

// ── Salespeople ──

export async function addSalesperson(sp: Omit<Salesperson, "id" | "createdAt">): Promise<Salesperson> {
  const { data, error } = await supabase
    .from("salespeople")
    .insert({ name: sp.name, phone: sp.phone, email: sp.email, role: sp.role })
    .select()
    .single();
  if (error) throw error;
  return rowToSalesperson(data);
}

export async function updateSalesperson(id: string, updates: Partial<Salesperson>): Promise<Salesperson | null> {
  const mapped: Record<string, unknown> = {};
  if (updates.name !== undefined) mapped.name = updates.name;
  if (updates.phone !== undefined) mapped.phone = updates.phone;
  if (updates.email !== undefined) mapped.email = updates.email;
  if (updates.role !== undefined) mapped.role = updates.role;

  const { data, error } = await supabase
    .from("salespeople")
    .update(mapped)
    .eq("id", id)
    .select()
    .single();
  if (error) return null;
  return rowToSalesperson(data);
}

export async function deleteSalesperson(id: string) {
  await supabase.from("salespeople").delete().eq("id", id);
}

// ── Deals ──

export async function addDeal(deal: Omit<Deal, "id" | "createdAt">): Promise<Deal> {
  const { data, error } = await supabase
    .from("deals")
    .insert({
      salesperson_id: deal.salespersonId,
      client_name: deal.clientName,
      product: deal.product,
      payment_type: deal.paymentType,
      total_amount: deal.totalAmount,
      commission_pct: deal.commissionPct,
      commission_paid: deal.commissionPaid,
      close_date: deal.closeDate,
      stage: deal.stage,
      lead_source: deal.leadSource,
      setter_id: deal.setterId || null,
      notes: deal.notes,
      call_ids: deal.callIds,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToDeal(data);
}

export async function updateDeal(id: string, updates: Partial<Deal>): Promise<Deal | null> {
  const mapped: Record<string, unknown> = {};
  if (updates.salespersonId !== undefined) mapped.salesperson_id = updates.salespersonId;
  if (updates.clientName !== undefined) mapped.client_name = updates.clientName;
  if (updates.product !== undefined) mapped.product = updates.product;
  if (updates.paymentType !== undefined) mapped.payment_type = updates.paymentType;
  if (updates.totalAmount !== undefined) mapped.total_amount = updates.totalAmount;
  if (updates.commissionPct !== undefined) mapped.commission_pct = updates.commissionPct;
  if (updates.commissionPaid !== undefined) mapped.commission_paid = updates.commissionPaid;
  if (updates.closeDate !== undefined) mapped.close_date = updates.closeDate;
  if (updates.stage !== undefined) mapped.stage = updates.stage;
  if (updates.leadSource !== undefined) mapped.lead_source = updates.leadSource;
  if (updates.setterId !== undefined) mapped.setter_id = updates.setterId;
  if (updates.notes !== undefined) mapped.notes = updates.notes;
  if (updates.callIds !== undefined) mapped.call_ids = updates.callIds;

  const { data, error } = await supabase.from("deals").update(mapped).eq("id", id).select().single();
  if (error) return null;
  return rowToDeal(data);
}

export async function moveDeal(id: string, stage: PipelineStage): Promise<Deal | null> {
  return updateDeal(id, { stage });
}

export async function deleteDeal(id: string) {
  // Payments & reminders cascade on delete
  await supabase.from("deals").delete().eq("id", id);
}

// ── Payments ──

export async function addPayment(payment: Omit<Payment, "id" | "createdAt">): Promise<Payment> {
  const { data, error } = await supabase
    .from("payments")
    .insert({
      deal_id: payment.dealId,
      amount: payment.amount,
      due_date: payment.dueDate,
      paid_date: payment.paidDate,
      verified: payment.verified,
      month_label: payment.monthLabel,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToPayment(data);
}

export async function verifyPayment(id: string): Promise<Payment | null> {
  const { data, error } = await supabase
    .from("payments")
    .update({ verified: true, paid_date: new Date().toISOString().split("T")[0] })
    .eq("id", id)
    .select()
    .single();
  if (error) return null;
  return rowToPayment(data);
}

export async function unverifyPayment(id: string): Promise<Payment | null> {
  const { data, error } = await supabase
    .from("payments")
    .update({ verified: false, paid_date: null })
    .eq("id", id)
    .select()
    .single();
  if (error) return null;
  return rowToPayment(data);
}

// ── Reminders ──

export async function addReminder(reminder: Omit<Reminder, "id">): Promise<Reminder> {
  const { data, error } = await supabase
    .from("reminders")
    .insert({
      payment_id: reminder.paymentId,
      salesperson_id: reminder.salespersonId,
      scheduled_for: reminder.scheduledFor,
      sent_at: reminder.sentAt,
      status: reminder.status,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToReminder(data);
}

export async function updateReminder(id: string, updates: Partial<Reminder>): Promise<Reminder | null> {
  const mapped: Record<string, unknown> = {};
  if (updates.scheduledFor !== undefined) mapped.scheduled_for = updates.scheduledFor;
  if (updates.sentAt !== undefined) mapped.sent_at = updates.sentAt;
  if (updates.status !== undefined) mapped.status = updates.status;

  const { data, error } = await supabase.from("reminders").update(mapped).eq("id", id).select().single();
  if (error) return null;
  return rowToReminder(data);
}

// ── Sales Calls ──

export async function addCall(call: Omit<SalesCall, "id" | "createdAt">): Promise<SalesCall> {
  const { data, error } = await supabase
    .from("sales_calls")
    .insert({
      title: call.title,
      date: call.date,
      duration: call.duration,
      participants: call.participants,
      salesperson_id: call.salespersonId,
      summary: call.summary,
      transcript: call.transcript,
      deal_id: call.dealId,
      source: call.source,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToCall(data);
}

export async function updateCall(id: string, updates: Partial<SalesCall>): Promise<SalesCall | null> {
  const mapped: Record<string, unknown> = {};
  if (updates.title !== undefined) mapped.title = updates.title;
  if (updates.date !== undefined) mapped.date = updates.date;
  if (updates.duration !== undefined) mapped.duration = updates.duration;
  if (updates.participants !== undefined) mapped.participants = updates.participants;
  if (updates.summary !== undefined) mapped.summary = updates.summary;
  if (updates.transcript !== undefined) mapped.transcript = updates.transcript;
  if (updates.dealId !== undefined) mapped.deal_id = updates.dealId;
  if (updates.source !== undefined) mapped.source = updates.source;

  const { data, error } = await supabase.from("sales_calls").update(mapped).eq("id", id).select().single();
  if (error) return null;
  return rowToCall(data);
}

export async function linkCallToDeal(callId: string, dealId: string) {
  await supabase.from("sales_calls").update({ deal_id: dealId }).eq("id", callId);
  // Also add callId to deal's call_ids array
  const { data: deal } = await supabase.from("deals").select("call_ids").eq("id", dealId).single();
  if (deal) {
    const ids: string[] = deal.call_ids || [];
    if (!ids.includes(callId)) {
      await supabase
        .from("deals")
        .update({ call_ids: [...ids, callId] })
        .eq("id", dealId);
    }
  }
}

// ── Payment schedule generation ──

export async function generatePaymentSchedule(deal: Deal): Promise<Payment[]> {
  const payments: Payment[] = [];
  const closeDate = new Date(deal.closeDate);

  switch (deal.paymentType) {
    case "PIF": {
      payments.push(
        await addPayment({
          dealId: deal.id,
          amount: deal.totalAmount,
          dueDate: deal.closeDate,
          paidDate: null,
          verified: false,
          monthLabel: "Full Payment",
        })
      );
      break;
    }
    case "DEP": {
      const deposit = deal.totalAmount * 0.5;
      const remaining = deal.totalAmount - deposit;
      payments.push(
        await addPayment({
          dealId: deal.id,
          amount: deposit,
          dueDate: deal.closeDate,
          paidDate: null,
          verified: false,
          monthLabel: "Deposit",
        })
      );
      const finDate = new Date(closeDate);
      finDate.setMonth(finDate.getMonth() + 1);
      payments.push(
        await addPayment({
          dealId: deal.id,
          amount: remaining,
          dueDate: finDate.toISOString().split("T")[0],
          paidDate: null,
          verified: false,
          monthLabel: "Final Payment",
        })
      );
      break;
    }
    case "Split":
    case "10K Split 5/5": {
      const splitCount = 2;
      const perPayment = deal.totalAmount / splitCount;
      for (let i = 0; i < splitCount; i++) {
        const date = new Date(closeDate);
        date.setMonth(date.getMonth() + i);
        payments.push(
          await addPayment({
            dealId: deal.id,
            amount: perPayment,
            dueDate: date.toISOString().split("T")[0],
            paidDate: null,
            verified: false,
            monthLabel: `Month ${i + 1}`,
          })
        );
      }
      break;
    }
    case "Inhouse Fin":
    case "Fin Payment":
    case "9K Climb":
    case "12K *": {
      const installments = 3;
      const perMonth = Math.round((deal.totalAmount / installments) * 100) / 100;
      for (let i = 0; i < installments; i++) {
        const date = new Date(closeDate);
        date.setMonth(date.getMonth() + i);
        const amount = i === installments - 1 ? deal.totalAmount - perMonth * (installments - 1) : perMonth;
        payments.push(
          await addPayment({
            dealId: deal.id,
            amount,
            dueDate: date.toISOString().split("T")[0],
            paidDate: null,
            verified: false,
            monthLabel: `Month ${i + 1}`,
          })
        );
      }
      break;
    }
  }

  return payments;
}

// ── Reminder generation ──

export async function generateReminders(deal: Deal, payments: Payment[]) {
  const unverified = payments.filter((p) => !p.verified);
  for (const payment of unverified) {
    const dueDate = new Date(payment.dueDate);
    const reminderDate = new Date(dueDate);
    reminderDate.setDate(reminderDate.getDate() - 3);
    await addReminder({
      paymentId: payment.id,
      salespersonId: deal.salespersonId,
      scheduledFor: reminderDate.toISOString(),
      sentAt: null,
      status: "pending",
    });
  }
}

// ── Commission ──

export async function payCommission(dealId: string, amount: number): Promise<Deal | null> {
  const { data: deal } = await supabase.from("deals").select("commission_paid").eq("id", dealId).single();
  if (!deal) return null;
  const newPaid = Number(deal.commission_paid) + amount;
  const { data, error } = await supabase
    .from("deals")
    .update({ commission_paid: newPaid })
    .eq("id", dealId)
    .select()
    .single();
  if (error) return null;
  return rowToDeal(data);
}

// ── Settings ──

export async function updateSettings(updates: Partial<AppSettings>) {
  const entries = Object.entries(updates).filter(([, v]) => v !== undefined);
  await Promise.all(
    entries.map(([key, value]) =>
      supabase.from("app_settings").upsert({ key, value: value ?? "" }, { onConflict: "key" })
    )
  );
}

export async function getSettings(): Promise<AppSettings> {
  const { data } = await supabase.from("app_settings").select("*");
  const settings: AppSettings = { ...defaultSettings };
  for (const row of data || []) {
    const k = row.key as keyof AppSettings;
    if (k in settings) {
      (settings as unknown as Record<string, unknown>)[k] = row.value || (k.endsWith("Sync") ? null : "");
    }
  }
  return settings;
}
