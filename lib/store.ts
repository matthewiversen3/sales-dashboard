"use client";

import { Deal, Payment, PipelineStage, Reminder, SalesCall, Salesperson } from "./types";

const STORAGE_KEY = "sales-dashboard-v2";

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

const defaultData: StoreData = {
  salespeople: [],
  deals: [],
  payments: [],
  reminders: [],
  calls: [],
  settings: defaultSettings,
};

function loadData(): StoreData {
  if (typeof window === "undefined") return defaultData;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultData;
    const parsed = JSON.parse(raw);
    // Migrate: add settings if missing
    if (!parsed.settings) parsed.settings = defaultSettings;
    return parsed;
  } catch {
    return defaultData;
  }
}

function saveData(data: StoreData) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function getData(): StoreData {
  return loadData();
}

export function generateId(): string {
  return crypto.randomUUID();
}

// Salespeople
export function addSalesperson(sp: Omit<Salesperson, "id" | "createdAt">): Salesperson {
  const data = loadData();
  const newSp: Salesperson = {
    ...sp,
    id: generateId(),
    createdAt: new Date().toISOString(),
  };
  data.salespeople.push(newSp);
  saveData(data);
  return newSp;
}

export function updateSalesperson(id: string, updates: Partial<Salesperson>): Salesperson | null {
  const data = loadData();
  const idx = data.salespeople.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  data.salespeople[idx] = { ...data.salespeople[idx], ...updates };
  saveData(data);
  return data.salespeople[idx];
}

export function deleteSalesperson(id: string) {
  const data = loadData();
  data.salespeople = data.salespeople.filter((s) => s.id !== id);
  saveData(data);
}

// Deals
export function addDeal(deal: Omit<Deal, "id" | "createdAt">): Deal {
  const data = loadData();
  const newDeal: Deal = {
    ...deal,
    id: generateId(),
    createdAt: new Date().toISOString(),
  };
  data.deals.push(newDeal);
  saveData(data);
  return newDeal;
}

export function updateDeal(id: string, updates: Partial<Deal>): Deal | null {
  const data = loadData();
  const idx = data.deals.findIndex((d) => d.id === id);
  if (idx === -1) return null;
  data.deals[idx] = { ...data.deals[idx], ...updates };
  saveData(data);
  return data.deals[idx];
}

export function moveDeal(id: string, stage: PipelineStage): Deal | null {
  return updateDeal(id, { stage });
}

export function deleteDeal(id: string) {
  const data = loadData();
  data.deals = data.deals.filter((d) => d.id !== id);
  data.payments = data.payments.filter((p) => p.dealId !== id);
  saveData(data);
}

// Payments
export function addPayment(payment: Omit<Payment, "id" | "createdAt">): Payment {
  const data = loadData();
  const newPayment: Payment = {
    ...payment,
    id: generateId(),
    createdAt: new Date().toISOString(),
  };
  data.payments.push(newPayment);
  saveData(data);
  return newPayment;
}

export function verifyPayment(id: string): Payment | null {
  const data = loadData();
  const idx = data.payments.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  data.payments[idx].verified = true;
  data.payments[idx].paidDate = new Date().toISOString();
  saveData(data);
  return data.payments[idx];
}

export function unverifyPayment(id: string): Payment | null {
  const data = loadData();
  const idx = data.payments.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  data.payments[idx].verified = false;
  data.payments[idx].paidDate = null;
  saveData(data);
  return data.payments[idx];
}

// Reminders
export function addReminder(reminder: Omit<Reminder, "id">): Reminder {
  const data = loadData();
  const newReminder: Reminder = {
    ...reminder,
    id: generateId(),
  };
  data.reminders.push(newReminder);
  saveData(data);
  return newReminder;
}

export function updateReminder(id: string, updates: Partial<Reminder>): Reminder | null {
  const data = loadData();
  const idx = data.reminders.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  data.reminders[idx] = { ...data.reminders[idx], ...updates };
  saveData(data);
  return data.reminders[idx];
}

// Sales Calls
export function addCall(call: Omit<SalesCall, "id" | "createdAt">): SalesCall {
  const data = loadData();
  const newCall: SalesCall = {
    ...call,
    id: generateId(),
    createdAt: new Date().toISOString(),
  };
  data.calls.push(newCall);
  saveData(data);
  return newCall;
}

export function updateCall(id: string, updates: Partial<SalesCall>): SalesCall | null {
  const data = loadData();
  const idx = data.calls.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  data.calls[idx] = { ...data.calls[idx], ...updates };
  saveData(data);
  return data.calls[idx];
}

export function linkCallToDeal(callId: string, dealId: string) {
  const data = loadData();
  const callIdx = data.calls.findIndex((c) => c.id === callId);
  if (callIdx !== -1) {
    data.calls[callIdx].dealId = dealId;
  }
  const dealIdx = data.deals.findIndex((d) => d.id === dealId);
  if (dealIdx !== -1 && !data.deals[dealIdx].callIds.includes(callId)) {
    data.deals[dealIdx].callIds.push(callId);
  }
  saveData(data);
}

// Generate payment schedule for a deal
export function generatePaymentSchedule(deal: Deal): Payment[] {
  const payments: Payment[] = [];
  const closeDate = new Date(deal.closeDate);

  switch (deal.paymentType) {
    case "PIF": {
      payments.push(
        addPayment({
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
        addPayment({
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
        addPayment({
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
          addPayment({
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
          addPayment({
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

// Generate reminders for upcoming payments
export function generateReminders(deal: Deal, payments: Payment[]) {
  const unverified = payments.filter((p) => !p.verified);
  for (const payment of unverified) {
    const dueDate = new Date(payment.dueDate);
    const reminderDate = new Date(dueDate);
    reminderDate.setDate(reminderDate.getDate() - 3);
    addReminder({
      paymentId: payment.id,
      salespersonId: deal.salespersonId,
      scheduledFor: reminderDate.toISOString(),
      sentAt: null,
      status: "pending",
    });
  }
}

// Pay commission
export function payCommission(dealId: string, amount: number): Deal | null {
  const data = loadData();
  const idx = data.deals.findIndex((d) => d.id === dealId);
  if (idx === -1) return null;
  data.deals[idx].commissionPaid += amount;
  saveData(data);
  return data.deals[idx];
}

// Settings
export function updateSettings(updates: Partial<AppSettings>) {
  const data = loadData();
  data.settings = { ...data.settings, ...updates };
  saveData(data);
  return data.settings;
}

export function getSettings(): AppSettings {
  const data = loadData();
  return data.settings || defaultSettings;
}
