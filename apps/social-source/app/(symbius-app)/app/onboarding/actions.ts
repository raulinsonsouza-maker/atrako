"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/symbius/auth";

export async function completeOnboarding() {
  const session = await getSession();
  if (!session) redirect("/login");

  await prisma.organization.update({
    where: { id: session.organizationId },
    data: { onboardingDone: true },
  });

  redirect("/app");
}
