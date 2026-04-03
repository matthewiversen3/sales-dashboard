"use client";

import { cn } from "@/lib/utils";

interface FilterChipsProps {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}

export function FilterChips({ options, value, onChange }: FilterChipsProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "px-3 py-1.5 rounded-xl text-[12px] font-medium transition-all duration-150",
            value === opt.value
              ? "bg-foreground text-background shadow-sm"
              : "bg-muted text-muted-foreground hover:text-foreground"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
