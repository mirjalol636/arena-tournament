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
  new Date(s).toLocaleDateString("uz-UZ", { month: "short", day: "numeric", timeZone: "Asia/Tashkent" });

export const time = (s: string) =>
  new Date(s).toLocaleTimeString("uz-UZ", {
    timeZone: "Asia/Tashkent",
    hour: "2-digit",
    minute: "2-digit",
  });

export const gameName = (g: string) =>
  g === "pubg" ? "PUBG Mobile" : "eFootball";

export const formatLabels: Record<string, string> = {
  single_elimination: "Bir mag‘lubiyatgacha",
  double_elimination: "Ikki mag‘lubiyatgacha",
  league: "Liga",
  groups_playoffs: "Guruhlar + Pley-off",
  round_robin: "Aylana tizim",
  upper: "Yuqori to‘r",
  lower: "Quyi to‘r",
  grand_final: "Katta final",
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
  create: "Yaratildi",
  update_tournament: "Turnir yangilandi",
  update_team: "Jamoa yangilandi",
  create_media: "Video qo‘shildi",
  update_media: "Video yangilandi",
  archive_media: "Video arxivlandi",
  review_registration: "Ariza ko‘rib chiqildi",
  change_role: "Ruxsat o‘zgartirildi",
  generate_schedule: "Jadval tuzildi",
  submit_result: "Natija yuborildi",
  confirm_result: "Natija tasdiqlandi",
  resolve_result: "Natija hal qilindi",
  update_match: "O‘yin yangilandi",
  create_match: "O‘yin yaratildi",
  update_scoring: "Ochko qoidalari yangilandi",
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
  media: "Media",
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

/** datetime-local fields always represent Tashkent (UTC+05), regardless of device. */
export const toUtc = (value:string) => new Date(`${value}:00+05:00`).toISOString();
export const tashkentInput = (value:string) => new Date(new Date(value).getTime()+5*3600000).toISOString().slice(0,16);

export const tashkentDay = (value:string|Date) => new Date(value).toLocaleDateString("en-CA",{timeZone:"Asia/Tashkent"});
