import { redirect } from "next/navigation";
import { getSession } from "@/lib/symbius/auth";
import { getOrganizationForSession } from "@/lib/symbius/tenant";
import { SettingsClient } from "@/components/symbius/SettingsClient";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const org = await getOrganizationForSession(session);

  return (
    <SettingsClient
      data={{
        orgName: org.nome,
        email: session.email,
        plan: org.plan,
        maxIgAccounts: org.maxIgAccounts,
        maxFluxos: org.maxFluxos,
        maxMembers: org.maxMembers,
        fluxosCount: org._count.fluxos,
        membersCount: org._count.members,
        igAccounts: org.igAccounts.map((a) => ({
          id: a.id,
          igUserId: a.igUserId,
          igUsername: a.igUsername,
          igProfilePictureUrl: a.igProfilePictureUrl,
          status: a.status,
          messagesEnabled: a.messagesEnabled,
          defaultReplyText: a.defaultReplyText,
        })),
      }}
    />
  );
}
