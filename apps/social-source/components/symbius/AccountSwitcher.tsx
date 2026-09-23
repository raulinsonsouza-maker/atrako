"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Pin, Plus, User } from "lucide-react";
import type { SymbiusShellData } from "@/lib/symbius/shellData";

export function AccountSwitcher({
  shell,
  collapsed,
}: {
  shell: SymbiusShellData;
  collapsed: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  async function switchOrg(organizationId: string) {
    await fetch("/api/symbius/workspaces/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId }),
    });
    router.refresh();
    window.location.href = "/app";
  }

  async function createWorkspace() {
    if (!newName.trim()) return;
    setCreating(true);
    await fetch("/api/symbius/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome: newName.trim() }),
    });
    setCreating(false);
    setNewName("");
    setOpen(false);
    window.location.href = "/app/connect";
  }

  async function togglePin(organizationId: string, pinned: boolean) {
    await fetch("/api/symbius/workspaces/pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId, pinned: !pinned }),
    });
    router.refresh();
  }

  async function switchIg(igAccountId: string | null) {
    await fetch("/api/symbius/active-ig", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ igAccountId }),
    });
    router.refresh();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="Trocar conta ou workspace"
        className={`symbius-account-block w-full text-left ${collapsed ? "symbius-account-block-collapsed" : ""}`}
      >
        <span className="symbius-account-avatar-wrap">
          <span className="symbius-account-avatar">
            {shell.igProfilePictureUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={shell.igProfilePictureUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <User className="h-5 w-5 text-zinc-400" strokeWidth={1.5} />
            )}
          </span>
        </span>
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1">
              <span className="symbius-account-name block truncate">
                {shell.accountDisplayName}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                {shell.plan}
              </span>
            </span>
            <ChevronDown className="symbius-account-chevron" strokeWidth={1.5} />
          </>
        )}
      </button>

      {open && !collapsed && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border border-zinc-200 bg-white py-1 shadow-lg">
          {shell.workspaces.map((w) => (
            <div
              key={w.id}
              className="flex items-center gap-2 px-3 py-2 hover:bg-zinc-50"
            >
              <button
                type="button"
                onClick={() => togglePin(w.id, w.pinned)}
                className="text-zinc-400 hover:text-zinc-700"
                title={w.pinned ? "Desafixar" : "Fixar"}
              >
                <Pin
                  className={`h-3.5 w-3.5 ${w.pinned ? "fill-current text-amber-500" : ""}`}
                />
              </button>
              <button
                type="button"
                onClick={() => switchOrg(w.id)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                {w.igProfilePictureUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={w.igProfilePictureUrl}
                    alt=""
                    className="h-7 w-7 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100">
                    <User className="h-4 w-4 text-zinc-400" />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {w.nome}
                  </span>
                  <span className="text-[10px] uppercase text-zinc-400">
                    {w.plan}
                    {w.inboxUnread > 0 ? ` · ${w.inboxUnread} inbox` : ""}
                  </span>
                </span>
                {w.isActive && (
                  <span className="text-[10px] font-semibold text-emerald-600">
                    Ativa
                  </span>
                )}
              </button>
            </div>
          ))}

          {shell.igAccounts.length > 1 && (
            <>
              <div className="my-1 border-t border-zinc-100" />
              <p className="px-3 py-1 text-[10px] font-semibold uppercase text-zinc-400">
                Instagram ativo
              </p>
              <button
                type="button"
                onClick={() => switchIg(null)}
                className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-zinc-50 ${!shell.activeIgAccountId ? "font-semibold" : ""}`}
              >
                Todas as contas
              </button>
              {shell.igAccounts.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => switchIg(a.id)}
                  className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-zinc-50 ${shell.activeIgAccountId === a.id ? "font-semibold" : ""}`}
                >
                  @{a.igUsername ?? a.pageName ?? a.id.slice(0, 6)}
                </button>
              ))}
            </>
          )}

          <div className="my-1 border-t border-zinc-100" />
          {newName ? (
            <div className="space-y-2 px-3 py-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nome do workspace"
                className="w-full rounded-lg border border-zinc-200 px-2 py-1.5 text-sm"
              />
              <button
                type="button"
                disabled={creating}
                onClick={() => void createWorkspace()}
                className="symbius-btn-primary w-full py-1.5 text-sm"
              >
                Criar
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setNewName("Nova conta")}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              <Plus className="h-4 w-4" />
              Nova Conta
            </button>
          )}
        </div>
      )}
    </div>
  );
}
