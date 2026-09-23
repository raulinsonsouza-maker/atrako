"use client";

import { useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { Button, Input, Card, CardHeader, CardTitle, CardContent } from "@/design/components";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const base = typeof window !== "undefined" ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000");
    const { error: err } = await authClient.requestPasswordReset({
      email,
      redirectTo: `${base}/auth/reset-password`,
    });
    setLoading(false);
    if (err) {
      setError(err.message || "Erro ao enviar e-mail.");
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>E-mail enviado</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-neutral-600">
            Se existir uma conta com esse e-mail, você receberá um link para redefinir a senha.
          </p>
          <Link href="/auth/login">
            <Button variant="outline" fullWidth className="mt-4">
              Voltar ao login
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Esqueci a senha</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="E-mail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          {error && <p className="text-sm text-error-600">{error}</p>}
          <Button type="submit" fullWidth isLoading={loading}>
            Enviar link
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-neutral-600">
          <Link href="/auth/login" className="text-primary-600 hover:underline">
            Voltar ao login
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
