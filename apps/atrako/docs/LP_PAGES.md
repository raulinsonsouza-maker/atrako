# Atrako Pages — padrão de LP para **todos** os clientes

Toda landing page de cliente no Atrako é **Pages** (`salesPage` **v3**: HTML + CSS no banco + mídia em `/lp-media`).

Isso vale para Stresser, Vilaris, Regicenter e **qualquer workspace novo**. Não criamos skin de cliente em `components.css` / React do monólito.

| Camada | Onde vive | Rebuild Docker? |
|--------|-----------|-----------------|
| Copy, layout, CSS, FAQ, sticky | `salesPage` v3 (DB) ou pacote `lp-pages/` | **Não** |
| Imagens / vídeo da LP | `/lp-media` (volume) | **Não** |
| Checkout, form, gallery/layers slots, API MP | `atrako-web` | **Sim** |
| Domínio (`lp.cliente.com`) | Traefik + `lp-domains.ts` (uma vez) | Stack |

## Formatos

| Formato | Uso |
|--------|-----|
| **v3 Pages** | **Canônico** — Criar (assistente), `publish-lp`, `seedPagesFromBrief` |
| v2 Puck | Legado (editor visual antigo) — só manter páginas já existentes |
| v1 seções | Legado — não usar em cliente novo |

## Novo cliente (onboarding)

1. Copiar template:
   ```bash
   cp -r apps/atrako/lp-pages/_template apps/atrako/lp-pages/{workspace}/{productSlug}
   ```
   Ou criar a página pelo **Criar** (assistente HTML) — já grava v3.
2. Ajustar `meta.json` (`productSlug`, `workspaceSlug`, fonts, gallery…).
3. Editar `page.html` / `page.css`.
4. Publicar **sem rebuild**:
   ```bash
   npx tsx scripts/publish-lp.ts {workspace}/{productSlug}
   # ou: npx tsx scripts/publish-lp.ts {productSlug}
   ```
5. Domínio (se houver): DNS + entrada em `lp-domains.ts` + router Traefik **uma vez**.

## Publish na VPS

```bash
WEB=$(docker ps -q -f name=atrako_web | head -n1)
set -a && source /opt/apps/atrako/.env && set +a
docker run --rm --network "container:${WEB}" \
  -e DATABASE_URL -e SOCIAL_DATABASE_URL -e UPLOADS_DIR=/data/uploads \
  -v /opt/apps/atrako/src/apps/atrako:/work \
  -v atrako_uploads:/data/uploads \
  -w /work --entrypoint "" atrako-web:latest \
  npx tsx scripts/publish-lp.ts stresser/pikolin-mood
```

## Pacote

```
lp-pages/
  _template/                 # modelo (não publica)
  {workspace}/{productSlug}/ # preferido (multi-cliente)
    meta.json
    page.html                # + <atrako-checkout|form|gallery|layers>
    page.css
    assets/                  # → /lp-media/{workspace}-{slug}-…
  pikolin-mood/              # legado flat (ainda suportado)
```

## Slots React (iguais para todos)

- `<atrako-checkout>` / `<atrako-form>`
- `<atrako-gallery>` / `<atrako-layers>` (dados em `meta.json`)

## Limites

- `MAX_LP_HTML` = 120 000  
- `MAX_LP_CSS` = 100 000  

## Política de engenharia

- **Proibido** adicionar CSS/tema de um cliente em `styles/design-system/components.css` ou ramificar `page.tsx` por `slug` de produto (exceto migração temporária).
- **Obrigatório** conteúdo de LP em v3 / `lp-pages` + `publish-lp` ou Criar HTML.
- Runtime compartilhado (checkout, uploads, tracking) permanece no shell Atrako.
