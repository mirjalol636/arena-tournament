import { Suspense } from "react";
import { TournamentPage } from "@/features/tournament";
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <Suspense>
      <TournamentPage slug={slug} />
    </Suspense>
  );
}
