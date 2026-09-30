import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const money = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);

export const date = (s: string) =>
  new Date(s).toLocaleDateString("uz-UZ", { month: "short", day: "numeric" });

export const time = (s: string) =>
  new Date(s).toLocaleTimeString("uz-UZ", {
    hour: "2-digit",
    minute: "2-digit",
  });

export const gameName = (g: string) =>
  g === "pubg" ? "PUBG Mobile" : "eFootball";

export const formatLabels: Record<string, string> = {
  single_elimination: "Single Elimination",
  double_elimination: "Double Elimination",
  league: "Liga",
  groups_playoffs: "Guruhlar + Pley-off",
  round_robin: "Aylana tizim",
  upper: "Yuqori to‘r",
  lower: "Quyi to‘r",
  grand_final: "Grand Final",
  playoffs: "Pley-off",
  group: "Guruh",
};

export const modeLabels: Record<string, string> = {
  solo: "Yakka",
  team: "Jamoa",
};

export const roleLabels: Record<string, string> = {
  PLAYER: "O‘yinchi",
  REFEREE: "Hakam",
  TOURNAMENT_MANAGER: "Turnir menejeri",
  ADMIN: "Administrator",
  SUPER_ADMIN: "Bosh administrator",
};

export const actionLabels: Record<string, string> = {
  created: "Yaratildi",
  updated: "Yangilandi",
  deleted: "O‘chirildi",
  approved: "Tasdiqlandi",
  rejected: "Rad etildi",
  scheduled: "Rejalashtirildi",
  completed: "Yakunlandi",
  submitted: "Yuborildi",
  disputed: "Nizo qo‘zg‘atildi",
  confirmed: "Tasdiqlandi",
};

export const entityLabels: Record<string, string> = {
  tournament: "Turnir",
  match: "O‘yin",
  registration: "Ro‘yxatdan o‘tish",
  result: "Natija",
  user: "Foydalanuvchi",
  team: "Jamoa",
  announcement: "E’lon",
};

export const formatName = (f: string) =>
  formatLabels[f] ||
  roleLabels[f] ||
  actionLabels[f] ||
  entityLabels[f] ||
  f.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
