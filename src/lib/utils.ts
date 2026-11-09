import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function parseEventDate(value: string | null | undefined): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? "");
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day), 12, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatEventDate(
  value: string | null | undefined,
  options: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", year: "numeric" },
  fallback = "Data a definir",
): string {
  const date = parseEventDate(value);
  return date ? date.toLocaleDateString("pt-BR", options) : fallback;
}