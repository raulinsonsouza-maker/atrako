"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, KeyRound, Shield, UserRound } from "lucide-react";
import { AppPage } from "@/components/layout/AppPage";
import { Button } from "@/components/ui/button";
import { PillSelect } from "@/components/ui/pill-select";
import { Switch } from "@/components/ui/switch";
import { TextField } from "@/components/ui/text-field";

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

const ROLE_OPTIONS = [
  { value: "ANALYST", label: "Analista" },
  { value: "ADMIN", label: "Administrador" },
];

export default function InternalUsersPage() {
  const [users, setUsers] = useState<InternalUser[]>([]);
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
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

  useEffect(() => {
    void load();
  }, [load]);

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
      setUsername("");
      setName("");
      setPassword("");
      setMessage("Usuário criado.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível criar o usuário.");
    } finally {
      setSaving(false);
    }
  }

  async function updateUser(
    id: string,
    changes: { role?: "ADMIN" | "ANALYST"; active?: boolean; password?: string; username?: string },
  ) {
    setError("");
    try {
      const response = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Não foi possível atualizar o usuário.");
      setUsers((current) =>
        current.map((user) => (user.id === id ? { ...user, ...data.user } : user)),
      );
      if (changes.password) setMessage("Senha redefinida.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível atualizar o usuário.");
    }
  }

  async function resetPassword(user: InternalUser) {
    const temporary = window.prompt(`Nova senha para ${user.username ?? "usuário"} (mínimo 12):`);
    if (!temporary) return;
    const nextUsername = user.username ?? window.prompt("Defina o username deste usuário:");
    if (!nextUsername) return;
    await updateUser(user.id, { password: temporary, username: nextUsername });
  }

  return (
    <AppPage title="Usuários">
      {error ? (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-[var(--radius-xs)] bg-[var(--accent)]/10 px-3 py-2 type-caption text-[var(--accent)]"
        >
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="flex items-center gap-2 rounded-[var(--radius-xs)] bg-[var(--success)]/10 px-3 py-2 type-caption text-[var(--success)]">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          {message}
        </div>
      ) : null}

      <section className="space-y-4 rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-[var(--canvas)] p-4">
        <p className="type-caption-strong text-[var(--ink)]">Novo usuário</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Usuário"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="3–40 caracteres"
            autoComplete="off"
          />
          <TextField
            label="Nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Opcional"
          />
          <TextField
            label="Senha"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 12"
            autoComplete="new-password"
          />
          <div>
            <p className="type-caption-strong text-[var(--ink)]">Função</p>
            <div className="mt-2">
              <PillSelect
                size="field"
                value={role}
                onChange={(v) => setRole(v as "ADMIN" | "ANALYST")}
                options={ROLE_OPTIONS}
                aria-label="Função"
              />
            </div>
          </div>
        </div>
        <Button type="button" disabled={saving || !username.trim() || !password} onClick={() => void createUser()}>
          {saving ? "Criando…" : "Criar"}
        </Button>
      </section>

      <ul className="divide-y divide-[var(--hairline)] rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-[var(--canvas)]">
        {loading ? (
          <li className="px-4 py-5 type-caption text-[var(--ink-muted-48)]">Carregando…</li>
        ) : users.length === 0 ? (
          <li className="px-4 py-5 type-caption text-[var(--ink-muted-48)]">Nenhum usuário interno.</li>
        ) : (
          users.map((user) => (
            <li
              key={user.id}
              className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-xs)] bg-[var(--surface-pearl)] text-[var(--ink-muted-48)]">
                  {user.role === "ADMIN" ? (
                    <Shield className="h-4 w-4" strokeWidth={1.75} />
                  ) : (
                    <UserRound className="h-4 w-4" strokeWidth={1.75} />
                  )}
                </span>
                <div className="min-w-0">
                  <p className="type-nav-link truncate text-[var(--ink)]">{user.name || user.username}</p>
                  <p className="type-fine-print text-[var(--ink-muted-48)]">@{user.username}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <PillSelect
                  value={user.role}
                  onChange={(v) => void updateUser(user.id, { role: v as "ADMIN" | "ANALYST" })}
                  options={ROLE_OPTIONS}
                  aria-label={`Função de ${user.name || user.username}`}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="!px-3 !py-1.5"
                  onClick={() => void resetPassword(user)}
                >
                  <KeyRound className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Senha
                </Button>
                <div className="flex items-center gap-2 pl-1">
                  <span className="type-fine-print text-[var(--ink-muted-48)]">
                    {user.active ? "Ativo" : "Off"}
                  </span>
                  <Switch
                    checked={user.active}
                    onChange={(active) => void updateUser(user.id, { active })}
                    aria-label={`Ativar ${user.name || user.username}`}
                  />
                </div>
              </div>
            </li>
          ))
        )}
      </ul>
    </AppPage>
  );
}
