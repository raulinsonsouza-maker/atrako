"use client";

import { useState, useEffect, useCallback } from "react";
import { Button, Input, Card, CardHeader, CardTitle, CardContent, Modal } from "@/design/components";
import { listUsersForManagement, inviteUser, updateUserRole } from "@/server/actions/user";
import { UserPlus } from "lucide-react";

const ROLE_LABEL: Record<string, string> = { TENANT_ADMIN: "Administrador", TENANT_USER: "Usuário" };

export function UsersSection({ tenantId }: { tenantId: string }) {
  const [users, setUsers] = useState<Awaited<ReturnType<typeof listUsersForManagement>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listUsersForManagement(tenantId);
      setUsers(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    load();
  }, [load]);

  async function onRoleChange(userId: string, role: "TENANT_ADMIN" | "TENANT_USER") {
    setError(null);
    try {
      await updateUserRole(tenantId, userId, role);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao atualizar");
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Usuários</CardTitle>
        <Button size="sm" onClick={() => { setShowInvite(true); setInviteLink(null); }}>
          <UserPlus className="mr-2 h-4 w-4" />
          Convidar
        </Button>
      </CardHeader>
      <CardContent>
        {error && <p className="mb-3 text-sm text-error-600">{error}</p>}
        {loading ? (
          <p className="text-neutral-500">Carregando…</p>
        ) : users.length === 0 ? (
          <p className="text-neutral-500">Nenhum usuário. Convide alguém para começar.</p>
        ) : (
          <div className="space-y-3">
            {users.map((u) => (
              <div
                key={u.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-neutral-200 bg-neutral-50/50 px-3 py-2"
              >
                <div>
                  <span className="font-medium text-neutral-900">{u.name}</span>
                  <span className="ml-2 text-sm text-neutral-500">{u.email}</span>
                </div>
                <select
                  value={u.role}
                  onChange={(e) => onRoleChange(u.id, e.target.value as "TENANT_ADMIN" | "TENANT_USER")}
                  className="rounded border border-neutral-300 bg-white px-2 py-1 text-sm"
                >
                  <option value="TENANT_ADMIN">{ROLE_LABEL.TENANT_ADMIN}</option>
                  <option value="TENANT_USER">{ROLE_LABEL.TENANT_USER}</option>
                </select>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <InviteModal
        open={showInvite}
        onClose={() => { setShowInvite(false); setInviteLink(null); }}
        onSuccess={(link) => { setInviteLink(link); load(); }}
        inviteLink={inviteLink}
        onSubmit={async (email, role) => {
          const r = await inviteUser(tenantId, { email, role });
          return r.inviteLink;
        }}
      />
    </Card>
  );
}

function InviteModal({
  open,
  onClose,
  onSuccess,
  inviteLink,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: (link: string) => void;
  inviteLink: string | null;
  onSubmit: (email: string, role: "TENANT_ADMIN" | "TENANT_USER") => Promise<string>;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"TENANT_ADMIN" | "TENANT_USER">("TENANT_USER");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) { setEmail(""); setRole("TENANT_USER"); setErr(null); }
  }, [open]);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const link = await onSubmit(email, role);
      onSuccess(link);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Convidar usuário"
      size="md"
      footer={
        inviteLink ? (
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        ) : (
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button form="invite-user-form" type="submit" isLoading={loading}>Enviar convite</Button>
          </div>
        )
      }
    >
      {inviteLink ? (
        <div className="space-y-2">
          <p className="text-sm text-neutral-600">Envie este link à pessoa:</p>
          <div className="flex gap-2">
            <input readOnly value={inviteLink} className="flex-1 rounded border border-neutral-300 px-3 py-2 text-sm" />
            <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(inviteLink)}>Copiar</Button>
          </div>
        </div>
      ) : (
        <form id="invite-user-form" onSubmit={submit} className="space-y-4">
          <Input label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Função</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "TENANT_ADMIN" | "TENANT_USER")}
              className="w-full rounded-sm border border-neutral-300 bg-white px-3 py-2"
            >
              <option value="TENANT_USER">{ROLE_LABEL.TENANT_USER}</option>
              <option value="TENANT_ADMIN">{ROLE_LABEL.TENANT_ADMIN}</option>
            </select>
          </div>
          {err && <p className="text-sm text-error-600">{err}</p>}
        </form>
      )}
    </Modal>
  );
}
