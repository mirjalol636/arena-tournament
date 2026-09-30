import { PlayerPage } from "@/features/account";
export default async function Page({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  return <PlayerPage username={username} />;
}
