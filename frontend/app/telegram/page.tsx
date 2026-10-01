"use client";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { useState } from "react";
import { Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";

export default function TelegramPage() {
  const router=useRouter(),auth=useAuth();
  const [message, setMessage] = useState(
      "Ushbu sahifani ARENA Telegram boti orqali oching.",
    ),
    [ready, setReady] = useState(false);
  return (
    <Shell>
      <Script
        src="https://telegram.org/js/telegram-web-app.js"
        onLoad={() => setReady(true)}
      />
      <div className="admin-login">
        <h1>Sizning arenangiz, ulangan.</h1>
        <p>{message}</p>
        <Button
          disabled={!ready}
          onClick={async () => {
            const w = window as unknown as {
              Telegram?: { WebApp?: { initData: string } };
            };
            if (!w.Telegram?.WebApp?.initData) {
              setMessage(
                "Tasdiqlangan Telegram hisobi topilmadi. Botning Mini App tugmasi orqali oching.",
              );
              return;
            }
            try {
              await auth.telegram(w.Telegram.WebApp.initData);
              router.push("/profile");
            } catch (e) {
              setMessage((e as Error).message);
            }
          }}
        >
          Telegram orqali davom etish
        </Button>
      </div>
    </Shell>
  );
}
