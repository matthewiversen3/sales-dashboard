export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : (plural || singular + "s");
}

export function formatDate(dateStr: string): string {
  // If already an ISO timestamp (contains 'T' or 'Z'), parse directly
  // Otherwise append T00:00:00 to treat as local date (avoid UTC offset shifting day)
  const date = dateStr.includes("T") || dateStr.includes("Z")
    ? new Date(dateStr)
    : new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function daysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = dateStr.includes("T") || dateStr.includes("Z")
    ? new Date(dateStr)
    : new Date(dateStr + "T00:00:00");
  const diff = target.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function getPaymentStatus(dueDate: string, verified: boolean): "collected" | "overdue" | "due-soon" | "upcoming" {
  if (verified) return "collected";
  const days = daysUntil(dueDate);
  if (days < 0) return "overdue";
  if (days <= 7) return "due-soon";
  return "upcoming";
}
