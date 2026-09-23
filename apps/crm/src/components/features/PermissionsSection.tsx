"use client";

import { useState, useEffect } from "react";
import {
  listPermissions,
  createPermission,
  updatePermission,
  deletePermission,
} from "@/server/actions/permission";
import { Button, Card, CardHeader, CardTitle, CardContent } from "@/design/components";
import { UserRole } from "@prisma/client";
import { Trash2 } from "lucide-react";

interface Permission {
  id: string;
  role: UserRole;
  resource: string;
  action: string;
  allowed: boolean;
}

const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: "Super Admin",
  TENANT_ADMIN: "Administrador",
  TENANT_USER: "Usuário",
};

const RESOURCES = [
  { value: "lead", label: "Leads" },
  { value: "opportunity", label: "Oportunidades" },
  { value: "sale", label: "Vendas" },
  { value: "task", label: "Tarefas" },
  { value: "activity", label: "Atividades" },
  { value: "user", label: "Usuários" },
  { value: "pipeline", label: "Pipeline" },
  { value: "tenant", label: "Configurações" },
];

const ACTIONS = [
  { value: "create", label: "Criar" },
  { value: "read", label: "Ler" },
  { value: "update", label: "Atualizar" },
  { value: "delete", label: "Deletar" },
  { value: "assign", label: "Atribuir" },
];

export function PermissionsSection({ tenantId }: { tenantId: string }) {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole>("TENANT_USER");
  const [error, setError] = useState<string | null>(null);

  const loadPermissions = async () => {
    setLoading(true);
    try {
      const p = await listPermissions(tenantId, selectedRole);
      setPermissions(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar permissões");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPermissions();
  }, [tenantId, selectedRole]);

  const handleToggle = async (id: string, currentAllowed: boolean) => {
    setSaving(true);
    try {
      await updatePermission(id, tenantId, { allowed: !currentAllowed });
      await loadPermissions();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao atualizar permissão");
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async (role: UserRole, resource: string, action: string) => {
    setSaving(true);
    try {
      await createPermission(tenantId, { role, resource, action, allowed: true });
      await loadPermissions();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao criar permissão");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover esta permissão customizada?")) return;
    setSaving(true);
    try {
      await deletePermission(id, tenantId);
      await loadPermissions();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao excluir permissão");
    } finally {
      setSaving(false);
    }
  };

  // Criar matriz de permissões
  const permissionMap = new Map<string, Permission>();
  permissions.forEach((p) => {
    permissionMap.set(`${p.resource}:${p.action}`, p);
  });

  if (loading) return <p className="text-neutral-500">Carregando permissões…</p>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Permissões Granulares</CardTitle>
      </CardHeader>
      <CardContent>
        {error && <p className="mb-4 text-sm text-error-600">{error}</p>}

        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Role
          </label>
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value as UserRole)}
            className="w-full rounded-sm border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
          >
            {Object.entries(ROLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-neutral-500">
            {selectedRole === "SUPER_ADMIN"
              ? "Super Admin tem todas as permissões automaticamente"
              : selectedRole === "TENANT_ADMIN"
                ? "Administradores têm todas as permissões por padrão, mas podem ser restringidas"
                : "Usuários têm permissões limitadas por padrão"}
          </p>
        </div>

        {selectedRole === "SUPER_ADMIN" ? (
          <p className="text-sm text-neutral-500">Super Admin tem todas as permissões.</p>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-700">
                    <th className="px-3 py-2 text-left text-neutral-700 dark:text-neutral-300">Recurso</th>
                    {ACTIONS.map((action) => (
                      <th key={action.value} className="px-3 py-2 text-center text-neutral-700 dark:text-neutral-300">
                        {action.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {RESOURCES.map((resource) => (
                    <tr key={resource.value} className="border-b border-neutral-100 dark:border-neutral-800">
                      <td className="px-3 py-2 font-medium text-neutral-900 dark:text-neutral-100">
                        {resource.label}
                      </td>
                      {ACTIONS.map((action) => {
                        const key = `${resource.value}:${action.value}`;
                        const permission = permissionMap.get(key);
                        const isAllowed = permission ? permission.allowed : getDefaultPermission(selectedRole, resource.value, action.value);

                        return (
                          <td key={action.value} className="px-3 py-2 text-center">
                            {permission ? (
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => handleToggle(permission.id, permission.allowed)}
                                  disabled={saving}
                                  className={`h-6 w-12 rounded-full transition-colors ${
                                    permission.allowed
                                      ? "bg-success-500"
                                      : "bg-neutral-300 dark:bg-neutral-600"
                                  }`}
                                >
                                  <span
                                    className={`block h-5 w-5 translate-x-0.5 rounded-full bg-white transition-transform ${
                                      permission.allowed ? "translate-x-6" : ""
                                    }`}
                                  />
                                </button>
                                <button
                                  onClick={() => handleDelete(permission.id)}
                                  disabled={saving}
                                  className="text-neutral-400 hover:text-error-600"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleCreate(selectedRole, resource.value, action.value)}
                                disabled={saving}
                                className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                                title={isAllowed ? "Permitido por padrão" : "Negado por padrão"}
                              >
                                {isAllowed ? "✓" : "✗"}
                              </button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-neutral-500">
              Clique em ✓ ou ✗ para criar uma permissão customizada. Use o toggle para alterar.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function getDefaultPermission(role: UserRole, resource: string, action: string): boolean {
  if (role === "TENANT_ADMIN") return true;
  if (role === "TENANT_USER") {
    if (action === "read") return true;
    if (resource === "lead" && action === "create") return true;
    if (resource === "activity" && action === "create") return true;
    if (resource === "task" && action === "create") return true;
    if (action === "update") return true;
    return false;
  }
  return false;
}
