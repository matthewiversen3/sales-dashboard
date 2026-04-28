"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme-provider";
import {
  LayoutDashboard,
  Kanban,
  Wallet,
  DollarSign,
  Users,
  Bell,
  Phone,
  Menu,
  X,
  Sun,
  Moon,
  Settings,
  MessageSquare,
  Repeat,
  Zap,
  Activity,
} from "lucide-react";
import { useState } from "react";

const navItems = [
  { href: "/outreach", label: "AI Outreach", icon: Zap },
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/follow-ups", label: "Follow-Ups", icon: Repeat },
  { href: "/", label: "Board", icon: Kanban },
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/collections", label: "Collections", icon: Wallet },
  { href: "/commissions", label: "Commissions", icon: DollarSign },
  { href: "/calls", label: "Calls", icon: Phone },
  { href: "/team", label: "Team", icon: Users },
  { href: "/systems", label: "Systems", icon: Activity },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { theme, toggle } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed top-4 left-4 z-50 md:hidden bg-card border border-border rounded-xl p-2.5 shadow-sm"
      >
        {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </button>

      {/* Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-full w-[240px] bg-sidebar border-r border-sidebar-border transition-transform duration-200 md:translate-x-0 flex flex-col",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 h-[60px] shrink-0">
          <div className="h-7 w-7 rounded-lg bg-foreground flex items-center justify-center">
            <span className="text-[10px] font-bold text-background tracking-tight">AR</span>
          </div>
          <span className="font-semibold text-[15px] tracking-[-0.01em]">AppRabbit</span>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-0.5 px-3 mt-1 flex-1">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-150",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-foreground shadow-sm"
                    : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}
              >
                <item.icon className="h-[18px] w-[18px]" strokeWidth={isActive ? 2 : 1.5} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom: theme toggle */}
        <div className="px-3 pb-4 mt-auto">
          <button
            onClick={toggle}
            className="flex items-center gap-3 w-full rounded-xl px-3 py-2.5 text-[13px] font-medium text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-all duration-150"
          >
            {theme === "light" ? (
              <Moon className="h-[18px] w-[18px]" strokeWidth={1.5} />
            ) : (
              <Sun className="h-[18px] w-[18px]" strokeWidth={1.5} />
            )}
            {theme === "light" ? "Dark mode" : "Light mode"}
          </button>
        </div>
      </aside>
    </>
  );
}
