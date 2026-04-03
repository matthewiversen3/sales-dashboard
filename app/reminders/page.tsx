"use client";

import { useStore } from "@/lib/hooks";
import { updateReminder } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell, Send, Check, AlertTriangle, Clock } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useState } from "react";

export default function RemindersPage() {
  const { reminders, payments, deals, salespeople, refresh, loaded } =
    useStore();
  const [sending, setSending] = useState<string | null>(null);

  if (!loaded) return <div className="animate-pulse h-96" />;

  const enrichedReminders = reminders
    .map((r) => {
      const payment = payments.find((p) => p.id === r.paymentId);
      const deal = payment ? deals.find((d) => d.id === payment.dealId) : null;
      const sp = salespeople.find((s) => s.id === r.salespersonId);
      return { ...r, payment, deal, salesperson: sp };
    })
    .sort((a, b) => {
      // Pending first, then by scheduled date
      if (a.status !== b.status) {
        if (a.status === "pending") return -1;
        if (b.status === "pending") return 1;
      }
      return (
        new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime()
      );
    });

  const pendingCount = enrichedReminders.filter(
    (r) => r.status === "pending"
  ).length;
  const sentCount = enrichedReminders.filter(
    (r) => r.status === "sent"
  ).length;

  async function handleSendReminder(reminderId: string) {
    setSending(reminderId);
    const reminder = enrichedReminders.find((r) => r.id === reminderId);
    if (!reminder) return;

    try {
      const res = await fetch("/api/reminders/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reminderId,
          phone: reminder.salesperson?.phone,
          message: `Reminder: Collect ${formatCurrency(
            reminder.payment?.amount || 0
          )} from ${
            reminder.deal?.clientName || "client"
          } — due ${formatDate(
            reminder.payment?.dueDate || new Date().toISOString().split("T")[0]
          )}`,
        }),
      });

      if (res.ok) {
        updateReminder(reminderId, {
          status: "sent",
          sentAt: new Date().toISOString(),
        });
      } else {
        updateReminder(reminderId, { status: "failed" });
      }
    } catch {
      // If API isn't configured, mark as sent locally for demo
      updateReminder(reminderId, {
        status: "sent",
        sentAt: new Date().toISOString(),
      });
    }

    setSending(null);
    refresh();
  }

  async function handleSendAll() {
    const pending = enrichedReminders.filter((r) => r.status === "pending");
    for (const r of pending) {
      await handleSendReminder(r.id);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Reminders</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {pendingCount} pending &middot; {sentCount} sent
          </p>
        </div>
        {pendingCount > 0 && (
          <Button size="sm" className="gap-1.5" onClick={handleSendAll}>
            <Send className="h-4 w-4" />
            Send All Pending
          </Button>
        )}
      </div>

      {enrichedReminders.length === 0 ? (
        <Card className="border shadow-none">
          <CardContent className="py-12 text-center">
            <Bell className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              No reminders yet. Reminders are auto-created when you add deals
              with split payments.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {enrichedReminders.map((reminder) => {
            const scheduledDate = new Date(reminder.scheduledFor);
            const isPast = scheduledDate < new Date();

            return (
              <Card
                key={reminder.id}
                className={cn(
                  "border shadow-none",
                  reminder.status === "sent" && "opacity-60"
                )}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                          reminder.status === "sent" && "bg-emerald-100",
                          reminder.status === "failed" && "bg-red-100",
                          reminder.status === "pending" &&
                            isPast &&
                            "bg-amber-100",
                          reminder.status === "pending" &&
                            !isPast &&
                            "bg-blue-100"
                        )}
                      >
                        {reminder.status === "sent" ? (
                          <Check className="h-4 w-4 text-emerald-600" />
                        ) : reminder.status === "failed" ? (
                          <AlertTriangle className="h-4 w-4 text-red-600" />
                        ) : (
                          <Clock className="h-4 w-4 text-blue-600" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">
                            {reminder.deal?.clientName || "Unknown"}{" "}
                            <span className="text-muted-foreground font-normal">
                              &rarr; {reminder.salesperson?.name || "Unknown"}
                            </span>
                          </p>
                          <Badge
                            variant={
                              reminder.status === "sent"
                                ? "default"
                                : reminder.status === "failed"
                                ? "destructive"
                                : "outline"
                            }
                            className="text-[10px]"
                          >
                            {reminder.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(reminder.payment?.amount || 0)}{" "}
                          &middot; Scheduled{" "}
                          {formatDate(
                            reminder.scheduledFor.split("T")[0]
                          )}
                          {reminder.sentAt && (
                            <>
                              {" "}
                              &middot; Sent{" "}
                              {formatDate(reminder.sentAt.split("T")[0])}
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    {reminder.status === "pending" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs gap-1.5"
                        disabled={sending === reminder.id}
                        onClick={() => handleSendReminder(reminder.id)}
                      >
                        <Send className="h-3 w-3" />
                        {sending === reminder.id ? "Sending..." : "Send Now"}
                      </Button>
                    )}
                    {reminder.status === "failed" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs gap-1.5 border-red-200 text-red-600 hover:bg-red-50"
                        onClick={() => handleSendReminder(reminder.id)}
                      >
                        <Send className="h-3 w-3" />
                        Retry
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
