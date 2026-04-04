"use client";

import { useStore } from "@/lib/hooks";
import { addSalesperson, deleteSalesperson, updateSalesperson } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Phone, Mail, User, Crown, Headphones } from "lucide-react";
import { useState } from "react";
import { formatCurrency, formatPhone, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function TeamPage() {
  const { salespeople, deals, payments, refresh, loaded } = useStore();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"rep" | "founder" | "setter">("rep");

  if (!loaded) return <div className="animate-pulse h-96" />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    if (editId) {
      await updateSalesperson(editId, { name, phone, email, role });
    } else {
      await addSalesperson({ name, phone, email, role });
    }
    resetForm();
    setOpen(false);
    await refresh();
  }

  function handleEdit(sp: (typeof salespeople)[0]) {
    setEditId(sp.id);
    setName(sp.name);
    setPhone(sp.phone);
    setEmail(sp.email);
    setRole(sp.role);
    setOpen(true);
  }

  function resetForm() {
    setEditId(null);
    setName("");
    setPhone("");
    setEmail("");
    setRole("rep");
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Team</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your sales team</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger render={<Button size="sm" className="gap-1.5" />}>
            <Plus className="h-4 w-4" /> Add Person
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editId ? "Edit Person" : "Add Person"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-3 mt-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Phone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (555) 000-0000" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@apprabbit.com" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Role</Label>
                <div className="flex gap-1.5">
                  {(["rep", "setter", "founder"] as const).map((r) => (
                    <button type="button" key={r} onClick={() => setRole(r)}
                      className={cn("px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors capitalize",
                        role === r ? "bg-foreground text-background border-foreground" : "bg-card text-muted-foreground border-border"
                      )}>{r}</button>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outline" size="sm" onClick={() => { setOpen(false); resetForm(); }}>Cancel</Button>
                <Button type="submit" size="sm">{editId ? "Update" : "Add"}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {salespeople.length === 0 ? (
        <Card className="border shadow-none">
          <CardContent className="py-12 text-center">
            <User className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No team members yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {salespeople.map((sp) => {
            const spDeals = deals.filter((d) => d.salespersonId === sp.id);
            const totalRevenue = spDeals.reduce((s, d) => s + d.totalAmount, 0);
            const totalCommission = spDeals.reduce((s, d) => s + d.totalAmount * (d.commissionPct / 100), 0);
            const commissionPaid = spDeals.reduce((s, d) => s + d.commissionPaid, 0);
            const spPayments = payments.filter((p) => spDeals.some((d) => d.id === p.dealId));
            const collected = spPayments.filter((p) => p.verified).reduce((s, p) => s + p.amount, 0);

            return (
              <Card key={sp.id} className="border shadow-none">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-semibold">
                        {sp.name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium">{sp.name}</p>
                          {sp.role === "founder" && <Crown className="h-3 w-3 text-amber-500" />}
                          {sp.role === "setter" && <Headphones className="h-3 w-3 text-blue-500" />}
                        </div>
                        <p className="text-xs text-muted-foreground">{spDeals.length} {pluralize(spDeals.length, "deal")}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => handleEdit(sp)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={async () => { await deleteSalesperson(sp.id); await refresh(); }} className="p-1.5 rounded-md hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-muted-foreground mb-3">
                    {sp.phone && <div className="flex items-center gap-2"><Phone className="h-3 w-3" />{formatPhone(sp.phone)}</div>}
                    {sp.email && <div className="flex items-center gap-2"><Mail className="h-3 w-3" />{sp.email}</div>}
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Pipeline</p>
                      <p className="text-sm font-semibold">{formatCurrency(totalRevenue)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Collected</p>
                      <p className="text-sm font-semibold text-emerald-600">{formatCurrency(collected)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Comm. Earned</p>
                      <p className="text-sm font-semibold">{formatCurrency(totalCommission)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Comm. Owed</p>
                      <p className="text-sm font-semibold text-amber-600">{formatCurrency(totalCommission - commissionPaid)}</p>
                    </div>
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
