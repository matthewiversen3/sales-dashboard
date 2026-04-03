"use client";

import {
  addSalesperson,
  addDeal,
  addCall,
  generatePaymentSchedule,
  generateReminders,
  getData,
  verifyPayment,
  linkCallToDeal,
} from "./store";
import type { PaymentType, PipelineStage, Product, LeadSource } from "./types";

interface SeedDeal {
  clientName: string;
  product: Product;
  paymentType: PaymentType;
  totalAmount: number;
  commissionPct: number;
  commissionPaid: number;
  closeDate: string;
  stage: PipelineStage;
  leadSource?: LeadSource;
  setterId?: string;
  notes: string;
  verifyFirst?: boolean;
  verifyAll?: boolean;
}

const seedTeam = [
  { name: "Wayne", phone: "+15559201001", email: "wayne@apprabbit.com", role: "rep" as const },
  { name: "Josh", phone: "+15559201002", email: "josh@apprabbit.com", role: "rep" as const },
  { name: "Matthew", phone: "+15559201000", email: "matthew@apprabbit.com", role: "founder" as const },
  { name: "Setter", phone: "+15559201003", email: "setter@apprabbit.com", role: "setter" as const },
];

function getSeedDeals(wayneId: string, joshId: string, matthewId: string, setterIdVal: string): (SeedDeal & { salespersonId: string })[] {
  return [
    // Wayne's deals
    {
      salespersonId: wayneId,
      clientName: "Rivera Fitness",
      product: "DFY Custom App Build",
      paymentType: "PIF",
      totalAmount: 10000,
      commissionPct: 10,
      commissionPaid: 1000,
      closeDate: "2026-01-12",
      stage: "paid",
      leadSource: "Referral",
      setterId: setterIdVal,
      notes: "Great client. Referred by a friend.",
      verifyAll: true,
    },
    {
      salespersonId: wayneId,
      clientName: "Apex Strength Lab",
      product: "DFY Custom App Build",
      paymentType: "Split",
      totalAmount: 8000,
      commissionPct: 10,
      commissionPaid: 400,
      closeDate: "2026-02-15",
      stage: "collecting",
      leadSource: "Meta Ads",
      setterId: setterIdVal,
      notes: "First split paid. Waiting on second.",
      verifyFirst: true,
    },
    {
      salespersonId: wayneId,
      clientName: "Metro Boxing Club",
      product: "DIY Custom App Build",
      paymentType: "PIF",
      totalAmount: 2000,
      commissionPct: 10,
      commissionPaid: 0,
      closeDate: "2026-03-20",
      stage: "closed",
      leadSource: "Cold Outreach",
      setterId: setterIdVal,
      notes: "Just closed. Invoice sent.",
    },
    {
      salespersonId: wayneId,
      clientName: "Pulse Fitness Center",
      product: "DFY Custom App Build",
      paymentType: "12K *",
      totalAmount: 12000,
      commissionPct: 12,
      commissionPaid: 0,
      closeDate: "2026-03-28",
      stage: "proposal",
      leadSource: "Meta Ads",
      setterId: setterIdVal,
      notes: "Very interested. Sent proposal last week.",
    },
    {
      salespersonId: wayneId,
      clientName: "CoreFit Gym",
      product: "DFY Custom App Build",
      paymentType: "PIF",
      totalAmount: 10000,
      commissionPct: 10,
      commissionPaid: 0,
      closeDate: "2026-04-01",
      stage: "lead",
      leadSource: "Inbound",
      setterId: setterIdVal,
      notes: "Discovery call done. Needs follow-up.",
    },

    // Josh's deals
    {
      salespersonId: joshId,
      clientName: "Iron Valley Gym",
      product: "DFY Custom App Build",
      paymentType: "PIF",
      totalAmount: 9000,
      commissionPct: 10,
      commissionPaid: 900,
      closeDate: "2026-01-20",
      stage: "paid",
      leadSource: "Referral",
      setterId: setterIdVal,
      notes: "Smooth deal. Happy client.",
      verifyAll: true,
    },
    {
      salespersonId: joshId,
      clientName: "Zenith Yoga Studio",
      product: "DIY Custom App Build",
      paymentType: "Inhouse Fin",
      totalAmount: 3000,
      commissionPct: 10,
      commissionPaid: 100,
      closeDate: "2026-02-10",
      stage: "collecting",
      notes: "Month 1 of 3 paid.",
      verifyFirst: true,
    },
    {
      salespersonId: joshId,
      clientName: "Titan Sports Academy",
      product: "DFY Custom App Build",
      paymentType: "DEP",
      totalAmount: 10000,
      commissionPct: 10,
      commissionPaid: 0,
      closeDate: "2026-03-15",
      stage: "collecting",
      notes: "Deposit received, waiting on final.",
      verifyFirst: true,
    },
    {
      salespersonId: joshId,
      clientName: "Summit Training Co",
      product: "DFY Custom App Build",
      paymentType: "10K Split 5/5",
      totalAmount: 10000,
      commissionPct: 10,
      commissionPaid: 0,
      closeDate: "2026-04-01",
      stage: "closed",
      notes: "Closing paperwork done.",
    },
    {
      salespersonId: joshId,
      clientName: "Glow Up Wellness",
      product: "DIY Custom App Build",
      paymentType: "PIF",
      totalAmount: 2000,
      commissionPct: 10,
      commissionPaid: 0,
      closeDate: "2026-04-02",
      stage: "proposal",
      notes: "Sent DIY proposal. Following up Friday.",
    },
    {
      salespersonId: joshId,
      clientName: "Flex Zone Fitness",
      product: "DFY Custom App Build",
      paymentType: "PIF",
      totalAmount: 10000,
      commissionPct: 10,
      commissionPaid: 0,
      closeDate: "2026-04-02",
      stage: "lead",
      notes: "Inbound lead from website.",
    },

    // Matthew's deals (solo calls)
    {
      salespersonId: matthewId,
      clientName: "Elite Performance",
      product: "DFY Custom App Build",
      paymentType: "9K Climb",
      totalAmount: 9000,
      commissionPct: 10,
      commissionPaid: 0,
      closeDate: "2026-03-01",
      stage: "collecting",
      notes: "Matthew closed this solo. Month 1 paid.",
      verifyFirst: true,
    },
    {
      salespersonId: matthewId,
      clientName: "Harmony Pilates",
      product: "DIY Custom App Build",
      paymentType: "PIF",
      totalAmount: 2500,
      commissionPct: 10,
      commissionPaid: 250,
      closeDate: "2026-02-20",
      stage: "paid",
      notes: "Quick close. Referral from Elite Performance.",
      verifyAll: true,
    },
  ];
}

const seedCalls = [
  { title: "Discovery Call - CoreFit Gym", date: "2026-03-28", duration: 32, participants: ["Wayne", "Matthew"], summary: "Owner interested in DFY. Has 3 locations. Wants branded app for member engagement. Budget around $10K." },
  { title: "Follow-up - Pulse Fitness Center", date: "2026-03-25", duration: 18, participants: ["Wayne"], summary: "Reviewed proposal. Owner liked the demo. Asking about payment plans. Will decide by end of week." },
  { title: "Demo Call - Glow Up Wellness", date: "2026-03-30", duration: 25, participants: ["Josh", "Matthew"], summary: "Showed DIY platform. Owner wants to try it. Concerned about tech setup. Josh offered onboarding help." },
  { title: "Closing Call - Summit Training Co", date: "2026-03-31", duration: 15, participants: ["Josh"], summary: "Signed the contract. 10K split 5/5. First payment due April 1st." },
  { title: "Discovery - Flex Zone Fitness", date: "2026-04-01", duration: 28, participants: ["Josh", "Matthew"], summary: "Inbound lead. Large gym chain. Interested in DFY. Wants to see case studies." },
  { title: "Check-in - Elite Performance", date: "2026-03-20", duration: 12, participants: ["Matthew"], summary: "Month 1 payment collected. Client happy with app progress. Discussing upsell for second location." },
];

export function seedDemoData() {
  const data = getData();
  if (data.salespeople.length > 0) return;

  const reps: Record<string, string> = {};
  for (const person of seedTeam) {
    const sp = addSalesperson(person);
    reps[person.name] = sp.id;
  }

  const deals = getSeedDeals(reps["Wayne"], reps["Josh"], reps["Matthew"], reps["Setter"]);

  const dealMap: Record<string, string> = {};
  for (const dealDef of deals) {
    const deal = addDeal({
      salespersonId: dealDef.salespersonId,
      clientName: dealDef.clientName,
      product: dealDef.product,
      paymentType: dealDef.paymentType,
      totalAmount: dealDef.totalAmount,
      commissionPct: dealDef.commissionPct,
      commissionPaid: dealDef.commissionPaid,
      closeDate: dealDef.closeDate,
      stage: dealDef.stage,
      leadSource: dealDef.leadSource || "Meta Ads",
      setterId: dealDef.setterId || null,
      notes: dealDef.notes,
      callIds: [],
    });

    dealMap[dealDef.clientName] = deal.id;

    // Only generate payments for deals past the lead/proposal stage
    if (dealDef.stage !== "lead" && dealDef.stage !== "proposal") {
      const payments = generatePaymentSchedule(deal);
      generateReminders(deal, payments);

      if (dealDef.verifyAll) {
        for (const p of payments) {
          verifyPayment(p.id);
        }
      } else if (dealDef.verifyFirst && payments.length > 0) {
        verifyPayment(payments[0].id);
      }
    }
  }

  // Seed calls
  for (const callDef of seedCalls) {
    const primaryParticipant = callDef.participants.find((p) => p !== "Matthew") || "Matthew";
    const spId = reps[primaryParticipant];

    const call = addCall({
      title: callDef.title,
      date: callDef.date,
      duration: callDef.duration,
      participants: callDef.participants,
      salespersonId: spId,
      summary: callDef.summary,
      transcript: "",
      dealId: null,
      source: "tldv",
    });

    // Link calls to matching deals by client name
    const clientName = callDef.title.replace(/^.*?-\s*/, "");
    if (dealMap[clientName]) {
      linkCallToDeal(call.id, dealMap[clientName]);
    }
  }
}
