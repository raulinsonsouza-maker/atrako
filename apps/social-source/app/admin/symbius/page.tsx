"use client";

import { useCallback, useEffect, useState } from "react";

type Org = {
  id: string;
  nome: string;
  slug: string;
  plan: string;
  status: string;
  maxIgAccounts: number;
  maxFluxos: number;
  maxMembers: number;
  _count: { members: number; igAccounts: number; fluxos: number };
};

export default function AdminSymbiusPage() {
  const [token, setToken] = useState("");
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [form, setForm] = useState({
    orgNome: "",
    ownerNome: "",
    ownerEmail: "",
    ownerPassword: "",
    plan: "FREE",
  });

  const headers = useCallback(
    () => ({ "x-admin-token": token, "Content-Type": "application/json" }),
    [token],
  );

  async function load() {
    if (!token) return;
    const res = await fetch("/api/admin/symbius", { headers: headers() });
    const data = await res.json();
    if (res.ok) setOrgs(data.orgs ?? []);
  }

  useEffect(() => {
    const saved = localStorage.getItem("adminToken");
    if (saved) setToken(saved);
  }, []);

  async function createOrg(e: React.FormEvent) {
    e.preventDefault();
    localStorage.setItem("adminToken", token);
    const res = await fetch("/api/admin/symbius", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setForm({
        orgNome: "",
        ownerNome: "",
        ownerEmail: "",
        ownerPassword: "",
        plan: "FREE",
      });
      load();
    } else {
      const err = await res.json();
      alert(err.error ?? "Erro");
    }
  }

  async function updatePlan(id: string, plan: string) {
    await fetch("/api/admin/symbius", {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify({ id, plan }),
    });
    load();
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Symbius Flow — Admin</h1>
        <p className="mt-1 text-[var(--muted-foreground)]">
          Provisionar organizações e planos (billing manual v1)
        </p>
      </div>

      <div className="flex gap-2">
        <input
          type="password"
          placeholder="ADMIN_SECRET"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2"
        />
        <button
          type="button"
          onClick={load}
          className="rounded-lg bg-[var(--primary)] px-4 py-2 font-medium text-white"
        >
          Carregar
        </button>
      </div>

      <form onSubmit={createOrg} className="grid max-w-xl gap-3 rounded-xl border border-[var(--border)] p-4">
        <h2 className="font-semibold">Nova organização</h2>
        <input
          placeholder="Nome da org"
          value={form.orgNome}
          onChange={(e) => setForm({ ...form, orgNome: e.target.value })}
          className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2"
          required
        />
        <input
          placeholder="Nome do owner"
          value={form.ownerNome}
          onChange={(e) => setForm({ ...form, ownerNome: e.target.value })}
          className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2"
          required
        />
        <input
          type="email"
          placeholder="E-mail owner"
          value={form.ownerEmail}
          onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })}
          className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2"
          required
        />
        <input
          type="password"
          placeholder="Senha owner"
          value={form.ownerPassword}
          onChange={(e) => setForm({ ...form, ownerPassword: e.target.value })}
          className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2"
          required
        />
        <select
          value={form.plan}
          onChange={(e) => setForm({ ...form, plan: e.target.value })}
          className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2"
        >
          <option value="FREE">FREE</option>
          <option value="PRO">PRO</option>
          <option value="AGENCY">AGENCY</option>
        </select>
        <button type="submit" className="rounded-lg bg-[var(--primary)] py-2 font-medium text-white">
          Criar org + usuário
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--muted)]">
              <th className="px-4 py-2 text-left">Org</th>
              <th className="px-4 py-2 text-left">Plano</th>
              <th className="px-4 py-2 text-left">Uso</th>
              <th className="px-4 py-2 text-left">Ações</th>
            </tr>
          </thead>
          <tbody>
            {orgs.map((o) => (
              <tr key={o.id} className="border-b border-[var(--border)]">
                <td className="px-4 py-2">{o.nome}</td>
                <td className="px-4 py-2">{o.plan}</td>
                <td className="px-4 py-2">
                  IG {o._count.igAccounts}/{o.maxIgAccounts} · Fluxos{" "}
                  {o._count.fluxos}/{o.maxFluxos >= 999 ? "∞" : o.maxFluxos}
                </td>
                <td className="px-4 py-2">
                  <select
                    defaultValue={o.plan}
                    onChange={(e) => updatePlan(o.id, e.target.value)}
                    className="rounded border border-[var(--border)] bg-[var(--card)] px-2 py-1"
                  >
                    <option value="FREE">FREE</option>
                    <option value="PRO">PRO</option>
                    <option value="AGENCY">AGENCY</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
