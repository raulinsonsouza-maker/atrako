import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getSession } from "@/lib/symbius/auth";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const session = await getSession();
  if (session) redirect(params.next ?? "/app");

  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
