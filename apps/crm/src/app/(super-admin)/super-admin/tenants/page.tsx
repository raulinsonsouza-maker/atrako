"use client";

import { useState, useEffect, useCallback } from "react";
import { Button, Input, Card, CardHeader, CardTitle, CardContent, Badge, Modal } from "@/design/components";
import { listTenants, createTenant, updateTenant, setTenantStatus, inviteTenantAdmin } from "@/server/actions/tenant";
import Link from "next/link";
import { Plus, Pencil, UserPlus, LogIn } from "lucide-react";

type TenantRow = Awaited<ReturnType<typeof listTenants>>[number];

const PLAN_LABEL: Record<string, string> = { STARTER: "Starter", PRO: "Pro", ENTERPRISE: "Enterprise" };
const STATUS_LABEL: Record<string, string> = { ACTIVE: "Ativo", SUSPENDED: "Suspenso", TRIAL: "Trial", CANCELLED: "Cancelado" };

export default function TenantsPage() {
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [inviteId, setInviteId] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listTenants();
      setTenants(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-neutral-900">Tenants</h2>
        <Button onClick={() => { setShowCreate(true); setInviteLink(null); }}>
          <Plus className="mr-2 h-4 w-4" />
          Novo tenant
        </Button>
      </div>

      {error && (
        <div className="rounded-sm border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Lista</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-neutral-500">Carregando...</div>
          ) : tenants.length === 0 ? (
            <div className="p-8 text-center text-neutral-500">Nenhum tenant.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50">
                    <th className="px-4 py-3 text-left font-medium text-neutral-700">Nome</th>
                    <th className="px-4 py-3 text-left font-medium text-neutral-700">Slug</th>
                    <th className="px-4 py-3 text-left font-medium text-neutral-700">Plano</th>
                    <th className="px-4 py-3 text-left font-medium text-neutral-700">Status</th>
                    <th className="px-4 py-3 text-left font-medium text-neutral-700">Usuários</th>
                    <th className="px-4 py-3 text-right font-medium text-neutral-700">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((t) => (
                    <tr key={t.id} className="border-b border-neutral-100">
                      <td className="px-4 py-3 text-neutral-900">{t.name}</td>
                      <td className="px-4 py-3 text-neutral-600">{t.slug}</td>
                      <td className="px-4 py-3">{PLAN_LABEL[t.plan] ?? t.plan}</td>
                      <td className="px-4 py-3">
                        <Badge variant={t.status === "ACTIVE" ? "success" : t.status === "SUSPENDED" ? "error" : "default"}>
                          {STATUS_LABEL[t.status] ?? t.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">{t._count.users}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          {t.status === "ACTIVE" && (
                            <Link
                              href={`/api/super-admin/view-as?tenant=${t.id}`}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-sm text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
                              title="Acessar área do tenant"
                            >
                              <LogIn className="h-4 w-4" aria-hidden />
                            </Link>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => setEditId(t.id)} aria-label="Editar">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => { setInviteId(t.id); setInviteLink(null); }} aria-label="Convidar admin">
                            <UserPlus className="h-4 w-4" />
                          </Button>
                          {t.status === "ACTIVE" ? (
                            <Button variant="outline" size="sm" onClick={async () => { await setTenantStatus(t.id, "SUSPENDED"); load(); }}>Suspender</Button>
                          ) : (
                            <Button variant="outline" size="sm" onClick={async () => { await setTenantStatus(t.id, "ACTIVE"); load(); }}>Ativar</Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <CreateModal
        open={showCreate}
        onClose={() => { setShowCreate(false); setInviteLink(null); }}
        onSuccess={() => setShowCreate(false)}
        onRefresh={load}
        inviteLink={inviteLink}
        setInviteLink={setInviteLink}
      />

      <EditModal
        open={!!editId}
        tenant={tenants.find((t) => t.id === editId) ?? null}
        onClose={() => setEditId(null)}
        onSuccess={() => { load(); setEditId(null); }}
      />

      <InviteModal
        open={!!inviteId}
        tenantId={inviteId}
        tenantName={tenants.find((t) => t.id === inviteId)?.name ?? ""}
        onClose={() => { setInviteId(null); setInviteLink(null); }}
        onSuccess={(link) => { setInviteLink(link); }}
        inviteLink={inviteId ? inviteLink : null}
      />
    </div>
  );
}

function CreateModal({
  open,
  onClose,
  onSuccess,
  onRefresh,
  inviteLink,
  setInviteLink,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onRefresh: () => void;
  inviteLink: string | null;
  setInviteLink: (v: string | null) => void;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { if (!open) { setName(""); setSlug(""); setAdminEmail(""); setErr(null); setInviteLink(null); } }, [open, setInviteLink]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const r = await createTenant({ name, slug, adminEmail: adminEmail || undefined });
      onRefresh();
      if (r.inviteLink) setInviteLink(r.inviteLink);
      else onSuccess();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Novo tenant" size="md" footer={
      inviteLink ? null : (
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button form="create-tenant-form" type="submit" isLoading={loading}>Criar</Button>
        </div>
      )
    }>
      {inviteLink ? (
        <div className="space-y-2">
          <p className="text-sm text-neutral-600">Convite criado. Envie este link ao admin:</p>
          <div className="flex gap-2">
            <input readOnly value={inviteLink} className="flex-1 rounded border border-neutral-300 px-3 py-2 text-sm" />
            <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(inviteLink); }}>Copiar</Button>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>Fechar</Button>
        </div>
      ) : (
        <form id="create-tenant-form" onSubmit={submit} className="space-y-4">
          <Input label="Nome" value={name} onChange={(e) => setName(e.target.value)} required />
          <Input label="Slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="ex: meu-tenant" required />
          <Input label="E-mail do admin (opcional)" type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} />
          {err && <p className="text-sm text-error-600">{err}</p>}
        </form>
      )}
    </Modal>
  );
}

function EditModal({
  open,
  tenant,
  onClose,
  onSuccess,
}: {
  open: boolean;
  tenant: TenantRow | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (tenant) {
      setName(tenant.name);
      setSlug(tenant.slug);
      setLogoUrl((tenant as { logoUrl?: string | null }).logoUrl ?? "");
      setPrimaryColor((tenant as { primaryColor?: string | null }).primaryColor ?? "");
      setErr(null);
    }
  }, [tenant]);

  if (!tenant) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!tenant) return;
    setErr(null);
    setLoading(true);
    try {
      await updateTenant(tenant.id, { name, slug, logoUrl: logoUrl.trim() || undefined, primaryColor: primaryColor.trim() || undefined });
      onSuccess();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Editar tenant" size="md" footer={
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button onClick={submit} isLoading={loading}>Salvar</Button>
      </div>
    }>
      <form onSubmit={submit} className="space-y-4">
        <Input label="Nome" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input label="Slug" value={slug} onChange={(e) => setSlug(e.target.value)} required />
        <Input label="URL do logo" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://..." />
        <Input label="Cor primária (hex)" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} placeholder="#16a34a" />
        {err && <p className="text-sm text-error-600">{err}</p>}
      </form>
    </Modal>
  );
}

function InviteModal({
  open,
  tenantId,
  tenantName,
  onClose,
  onSuccess,
  inviteLink,
}: {
  open: boolean;
  tenantId: string | null;
  tenantName: string;
  onClose: () => void;
  onSuccess: (link: string) => void;
  inviteLink: string | null;
}) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { if (!open) { setEmail(""); setErr(null); } }, [open]);

  if (!tenantId) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const r = await inviteTenantAdmin(tenantId!, email);
      onSuccess(r.inviteLink);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Convidar admin — ${tenantName}`} size="md" footer={
      inviteLink ? (
        <Button variant="outline" onClick={onClose}>Fechar</Button>
      ) : (
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} isLoading={loading}>Enviar convite</Button>
        </div>
      )
    }>
      {inviteLink ? (
        <div className="space-y-2">
          <p className="text-sm text-neutral-600">Envie este link ao admin:</p>
          <div className="flex gap-2">
            <input readOnly value={inviteLink} className="flex-1 rounded border border-neutral-300 px-3 py-2 text-sm" />
            <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(inviteLink)}>Copiar</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Input label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          {err && <p className="text-sm text-error-600">{err}</p>}
        </form>
      )}
    </Modal>
  );
}
