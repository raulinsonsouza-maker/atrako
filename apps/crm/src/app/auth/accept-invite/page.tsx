"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button, Input, Card, CardHeader, CardTitle, CardContent } from "@/design/components";

function AcceptInviteForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    if (!token) setInvalid(true);
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/invites/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, name, password }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.message || "Erro ao aceitar convite.");
      return;
    }
    window.location.href = "/auth/login";
  }

  if (invalid || !token) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Convite inválido</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-neutral-600">Link de convite ausente ou inválido.</p>
          <Link href="/auth/login">
            <Button variant="outline" fullWidth className="mt-4">
              Ir para o login
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Aceitar convite</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
          />
          <Input
            label="Senha"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
          {error && <p className="text-sm text-error-600">{error}</p>}
          <Button type="submit" fullWidth isLoading={loading}>
            Criar conta
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<Card><CardHeader><CardTitle>Carregando...</CardTitle></CardHeader><CardContent><p className="text-neutral-600">Aguarde.</p></CardContent></Card>}>
      <AcceptInviteForm />
    </Suspense>
  );
}
