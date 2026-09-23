"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, Shield, UserRound, UserRoundPlus } from "lucide-react";
import { PillSelect } from "@/components/ui/pill-select";

type InternalUser = {
  id: string;
  username: string | null;
  name: string | null;
  role: "ADMIN" | "ANALYST";
  active: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt: string;
};

export default function InternalUsersPage() {
  const [users, setUsers] = useState<InternalUser[]>([]);
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<"ADMIN" | "ANALYST">("ANALYST");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/users");
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Não foi possível carregar os usuários.");
      setUsers(data.users ?? []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível carregar os usuários.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function createUser() {
    setMessage("");
    setError("");
    setSaving(true);
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, name, password, role }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Não foi possível criar o usuário.");
      setUsername(""); setName(""); setPassword("");
      setMessage("Usuário criado. A senha cadastrada já está válida.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível criar o usuário.");
    } finally {
      setSaving(false);
    }
  }

  async function updateUser(id: string, changes: { role?: "ADMIN" | "ANALYST"; active?: boolean; password?: string; username?: string }) {
    setError("");
    try {
      const response = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Não foi possível atualizar o usuário.");
      setUsers((current) => current.map((user) => user.id === id ? { ...user, ...data.user } : user));
      if (changes.password) setMessage("Senha redefinida e válida a partir de agora.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível atualizar o usuário.");
    }
  }

  async function resetPassword(user: InternalUser) {
    const temporary = window.prompt(`Nova senha para ${user.username ?? "usuário"} (mínimo 12 caracteres):`);
    if (temporary) {
      const nextUsername = user.username ?? window.prompt("Defina também o username deste usuário:");
      if (!nextUsername) return;
      await updateUser(user.id, { password: temporary, username: nextUsername });
    }
  }

  return (
    <main className="mx-auto max-w-5xl space-y-8 py-4">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="mt-1 h-8 w-1 rounded-full bg-[var(--primary)]" />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">Administração</p>
            <h1 className="text-2xl font-extrabold tracking-tight">Usuários internos</h1>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">Crie acessos locais e controle função e status.</p>
          </div>
        </div>
        <Link href="/admin/configuracoes" className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] px-3 py-2 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
          <ArrowLeft className="h-3.5 w-3.5" /> Configurações
        </Link>
      </header>

      {error && <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}
      {message && <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300"><CheckCircle2 className="h-4 w-4" />{message}</div>}

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
        <div className="mb-4 flex items-center gap-2">
          <UserRoundPlus className="h-4 w-4 text-[var(--primary)]" />
          <h2 className="font-semibold">Criar usuário</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="usuário (3–40 caracteres)" className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm" />
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome de exibição (opcional)" className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm" />
          <div className="relative">
            <input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Senha (mínimo 12)" className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 pr-11 text-sm" />
            <button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <PillSelect
            className="w-full"
            size="field"
            value={role}
            onChange={(v) => setRole(v as "ADMIN" | "ANALYST")}
            options={[
              { value: "ANALYST", label: "Analista" },
              { value: "ADMIN", label: "Administrador" },
            ]}
            aria-label="Função"
          />
        </div>
        <button onClick={() => void createUser()} disabled={saving} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
          {saving ? "Criando…" : "Criar usuário"}
        </button>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
        <div className="border-b border-[var(--border)] px-5 py-4"><h2 className="font-semibold">Acessos cadastrados</h2></div>
        {loading ? <p className="p-5 text-sm text-[var(--muted-foreground)]">Carregando…</p> : users.length === 0 ? (
          <p className="p-5 text-sm text-[var(--muted-foreground)]">Nenhum usuário interno cadastrado.</p>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {users.map((user) => (
              <div key={user.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${user.role === "ADMIN" ? "bg-amber-500/15 text-amber-400" : "bg-sky-500/15 text-sky-400"}`}>
                    {user.role === "ADMIN" ? <Shield className="h-4 w-4" /> : <UserRound className="h-4 w-4" />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{user.name || user.username}</p>
                    <p className="text-xs text-[var(--muted-foreground)]">@{user.username} · senha definida</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <PillSelect
                    value={user.role}
                    onChange={(v) => void updateUser(user.id, { role: v as "ADMIN" | "ANALYST" })}
                    options={[
                      { value: "ANALYST", label: "Analista" },
                      { value: "ADMIN", label: "Administrador" },
                    ]}
                    aria-label={`Função de ${user.name || user.username}`}
                  />
                  <button onClick={() => void resetPassword(user)} className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs"><KeyRound className="h-3.5 w-3.5" /> Redefinir</button>
                  <button onClick={() => void updateUser(user.id, { active: !user.active })} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${user.active ? "border-emerald-500/30 text-emerald-400" : "border-red-500/30 text-red-400"}`}>
                    {user.active ? "Ativo" : "Desativado"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}