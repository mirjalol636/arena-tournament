import type { Metadata, Viewport } from "next";
import { AuthProvider } from "@/components/auth-provider";
import { Toaster } from "sonner";
import { GeistSans } from "geist/font/sans";
import "./globals.css";

export const viewport: Viewport = { themeColor: "#090a10", width: "device-width", initialScale: 1, viewportFit: "cover" };

export const metadata: Metadata = {
  title: "ARENA — Raqobatbardoshlar uchun yaratilgan",
  description:
    "ARENA bilan bellashing, jonli o‘yinlarni kuzating va eFootball hamda PUBG Mobile turnirlarini boshqaring.",
  icons: { icon: "/favicon.svg" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="uz"
      data-scroll-behavior="smooth"
      className={GeistSans.variable}
    >
      <body>
        <AuthProvider>
          {children}
          <Toaster theme="dark" richColors position="bottom-right" />
        </AuthProvider>
      </body>
    </html>
  );
}
