"use client";
import { ErrorState } from "@/components/competition";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <ErrorState
      message="Kutilmagan xatolik yuz berdi. Iltimos, qaytadan urinib ko‘ring."
      retry={reset}
    />
  );
}
