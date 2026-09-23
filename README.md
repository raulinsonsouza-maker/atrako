# Atrako

Monorepo do **Atrako** — inteligência comercial e central de dados para aumentar o faturamento de infoprodutores, mentores, consultores e e-commerces.

## Docs

- [Produto](docs/PRODUCT.md)
- [Arquitetura](docs/ARCHITECTURE.md)

## Apps

| App | Pacote | Porta típica |
|-----|--------|--------------|
| Shell (agente + insights) | `apps/atrako` (`@atrako/shell`) | 5000 |
| CRM + WhatsApp | `apps/crm` | 3000 |
| Agenda | `apps/agenda` | 3000 |
| LP + Checkout | `apps/commerce` | 3000 |
| Social (contrato) | `apps/social` | — |
| Social (fonte Symbius) | `apps/social-source` | — |

## Packages

`@atrako/events`, `@atrako/db`, `@atrako/agent`, `@atrako/forms`

## Desenvolvimento

```bash
npm install
npm run dev:atrako
```

Home = agente de IA. Insights = `/insights`. Módulos = `/modules/*`.
