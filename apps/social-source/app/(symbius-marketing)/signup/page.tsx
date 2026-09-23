import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getSession } from "@/lib/symbius/auth";
import { SignupContent } from "./SignupContent";

export default async function SignupPage() {
  const session = await getSession();
  if (session) redirect("/app");

  return (
    <Suspense>
      <SignupContent />
    </Suspense>
  );
}
