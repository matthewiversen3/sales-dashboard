export type PipelineStage = "lead" | "proposal" | "closed" | "collecting" | "paid";

export type Product = "DFY Custom App Build" | "DIY Custom App Build";

export type PaymentType =
  | "PIF"
  | "DEP"
  | "Split"
  | "Inhouse Fin"
  | "Fin Payment"
  | "10K Split 5/5"
  | "9K Climb"
  | "12K *";

export type LeadSource = "Meta Ads" | "Referral" | "Cold Outreach" | "Inbound" | "GHL" | "Other";

export type ReminderStatus = "pending" | "sent" | "failed";

export const PIPELINE_STAGES: { key: PipelineStage; label: string; color: string; darkColor: string }[] = [
  { key: "lead", label: "Lead", color: "bg-blue-50 border-blue-200", darkColor: "dark:bg-blue-950/30 dark:border-blue-800/40" },
  { key: "proposal", label: "Proposal", color: "bg-purple-50 border-purple-200", darkColor: "dark:bg-purple-950/30 dark:border-purple-800/40" },
  { key: "closed", label: "Closed", color: "bg-amber-50 border-amber-200", darkColor: "dark:bg-amber-950/30 dark:border-amber-800/40" },
  { key: "collecting", label: "Collecting", color: "bg-orange-50 border-orange-200", darkColor: "dark:bg-orange-950/30 dark:border-orange-800/40" },
  { key: "paid", label: "Paid", color: "bg-emerald-50 border-emerald-200", darkColor: "dark:bg-emerald-950/30 dark:border-emerald-800/40" },
];

export const LEAD_SOURCES: LeadSource[] = ["Meta Ads", "Referral", "Cold Outreach", "Inbound", "GHL", "Other"];

export const PRODUCTS: Product[] = [
  "DFY Custom App Build",
  "DIY Custom App Build",
];

export const PAYMENT_TYPES: PaymentType[] = [
  "PIF",
  "DEP",
  "Split",
  "Inhouse Fin",
  "Fin Payment",
  "10K Split 5/5",
  "9K Climb",
  "12K *",
];

export interface Salesperson {
  id: string;
  name: string;
  phone: string;
  email: string;
  role: "founder" | "rep" | "setter";
  createdAt: string;
}

export interface Deal {
  id: string;
  salespersonId: string;
  clientName: string;
  product: Product;
  paymentType: PaymentType;
  totalAmount: number;
  commissionPct: number;
  commissionPaid: number;
  closeDate: string;
  stage: PipelineStage;
  leadSource: LeadSource;
  setterId: string | null;
  notes: string;
  callIds: string[];
  createdAt: string;
}

export interface Payment {
  id: string;
  dealId: string;
  amount: number;
  dueDate: string;
  paidDate: string | null;
  verified: boolean;
  monthLabel: string;
  createdAt: string;
}

export interface Reminder {
  id: string;
  paymentId: string;
  salespersonId: string;
  scheduledFor: string;
  sentAt: string | null;
  status: ReminderStatus;
}

export interface SalesCall {
  id: string;
  title: string;
  date: string;
  duration: number;
  participants: string[];
  salespersonId: string;
  summary: string;
  transcript: string;
  dealId: string | null;
  source: "tldv" | "manual";
  createdAt: string;
}
