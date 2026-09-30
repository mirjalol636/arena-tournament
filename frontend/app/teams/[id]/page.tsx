import { TeamPage } from "@/features/account";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TeamPage id={id} />;
}
