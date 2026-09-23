# Packages do Atrako

Pacotes compartilhados do monorepo. Sem dependências circulares entre módulos de app.

| Pacote | Responsabilidade |
|--------|------------------|
| `@atrako/events` | Contratos versionados da jornada + `publishEventBatch` |
| `@atrako/db` | Schema canônico PostgreSQL (`Workspace`, contatos, leads, outbox) |
| `@atrako/agent` | Registry de tools do agente (riscos + preview + confirmação) |
| `@atrako/forms` | Motor de formulários condicionais (Fase 5) |

Apps de módulo: `@atrako/shell`, `@atrako/crm`, `@atrako/agenda`, `@atrako/commerce`, `@atrako/social`.

Planejados: `auth` (SSO), `integrations`, `ui`.
