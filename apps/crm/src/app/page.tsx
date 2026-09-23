import Link from "next/link";
import { Button } from "@/design/components";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-neutral-900">CRM</h1>
        <p className="mt-2 text-neutral-600">Gestão de leads e atendimento</p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/auth/login">
          <Button variant="accent" size="lg">
            Entrar
          </Button>
        </Link>
      </div>
    </main>
  );
}
