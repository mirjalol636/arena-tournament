"use client";
import Script from "next/script";
import { useState } from "react";
import { mutate } from "@/services/api";
import { Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";

export default function TelegramPage() {
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
              await mutate("/auth/telegram", {
                init_data: w.Telegram.WebApp.initData,
              });
              window.location.href = "/profile";
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
