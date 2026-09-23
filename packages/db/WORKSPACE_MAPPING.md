# Mapeamento Workspace ↔ Cliente (shell)

| Conceito canônico (`@atrako/db`) | Shell atual (`apps/atrako`) |
|----------------------------------|-----------------------------|
| `Workspace.id` | `Cliente.id` |
| `Workspace.name` | `Cliente.nome` |
| `Workspace.slug` | `Cliente.slug` |
| `AtrakoEvent.workspaceId` | coluna `AtrakoEvent.clienteId` |
| `OutboxEvent.workspaceId` | coluna `AtrakoOutbox.clienteId` |

Os contratos de evento sempre usam `context.workspaceId`. O bridge grava em `clienteId` porque é a FK existente — semanticamente é o mesmo tenant.

Migração física para tabelas `Workspace` do `@atrako/db` fica para quando o SSO e o cutover de produção forem feitos. Até lá, **não** introduzir um segundo banco de eventos.
