# lib/integrations

Clientes HTTP únicos para Meta, Instagram, Mercado Pago e Google.

| Pasta | Responsabilidade | Resolve via Config |
|-------|------------------|--------------------|
| `meta/` | Graph version, ads insights, pixel | `resolveMetaAds` / tracking |
| `instagram/` | Perfil / messaging Graph | `resolveInstagram` |
| `mercadopago/` | Pagamentos + webhooks | `resolveMercadoPago` |
| `google/` | Ads / GA4 flags | `GOOGLE_*` env + conexões |

Fluxo: `/config/conexoes` → `WorkspaceConnection.credentialsEnc` → `resolve*(workspaceId)` → funções desta pasta.

Ver `docs/INTEGRATIONS.md`.
