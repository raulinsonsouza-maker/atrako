"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { Button, Input, Card, CardHeader, CardTitle, CardContent } from "@/design/components";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    if (!token) setInvalid(true);
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError(null);
    setLoading(true);
    const { error: err } = await authClient.resetPassword({ newPassword: password, token });
    setLoading(false);
    if (err) {
      setError(err.message || "Erro ao redefinir senha.");
      return;
    }
    setDone(true);
  }

  if (invalid || !token) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Link inválido</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-neutral-600">Token ausente ou expirado. Solicite um novo link.</p>
          <Link href="/auth/forgot-password">
            <Button variant="outline" fullWidth className="mt-4">
              Esqueci a senha
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (done) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Senha alterada</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-neutral-600">Sua senha foi redefinida. Faça login com a nova senha.</p>
          <Link href="/auth/login">
            <Button fullWidth className="mt-4">
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
        <CardTitle>Nova senha</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nova senha"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
          {error && <p className="text-sm text-error-600">{error}</p>}
          <Button type="submit" fullWidth isLoading={loading}>
            Redefinir senha
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<Card><CardHeader><CardTitle>Carregando...</CardTitle></CardHeader><CardContent><p className="text-neutral-600">Aguarde.</p></CardContent></Card>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
