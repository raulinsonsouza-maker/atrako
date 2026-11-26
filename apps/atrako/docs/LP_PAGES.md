# Atrako Pages — padrão de LP para **todos** os clientes

Toda landing page de cliente no Atrako é **Pages** (`salesPage` **v3**: HTML + CSS no banco + mídia em `/lp-media`).

Isso vale para Stresser, Vilaris, Regicenter e **qualquer workspace novo**. Não criamos skin de cliente em `components.css` / React do monólito.

| Camada | Onde vive | Rebuild Docker? |
|--------|-----------|-----------------|
| Copy, layout, CSS, FAQ, sticky, `@atrako-slots` | `salesPage` v3 (DB) / `lp-pages/` → `publish-lp` | **Não** |
| Labels/perks/textos/flags do checkout (`meta.checkout`) | `salesPage.checkout` via `publish-lp` | **Não** |
| Preço espelhado (`data-atrako-live-price`) | HTML do pacote + hook já no shell | **Não** |
| Imagens / vídeo da LP | `/lp-media` (volume) | **Não** |
| Campos do lead form | Form no DB (`formId`) | **Não** |
| Novo comportamento React/API (Pix, MP, CEP, slots) | `atrako-web` rebuild rolling | **Sim** (todos, rolling) |
| Domínio (`lp.cliente.com`) | Traefik + `lp-domains.ts` (uma vez) | Stack |
| Novo workspace | seed + pacote Pages | **Não** |

### Regra de deploy (obrigatória)

1. Mudou só `lp-pages/**` (html/css/meta/assets)? → **apenas** `publish-lp`. Sem `docker build`.
2. Mudou React/API/`components.css` do shell? → aí sim rebuild — e **não** misturar com copy de LP no mesmo “deploy mental”.
3. PR misto: **primeiro** `publish-lp` (conteúdo no ar), **depois** rebuild só se o runtime novo for necessário.
4. Preferir hooks declarativos (`data-atrako-*`, `@atrako-slots`, `meta.checkout`) a código React por cliente — o hook nasce uma vez no shell; o resto é pacote.
5. Rebuild do shell: preferir `docker stack deploy` com `replicas: 2` + `update_config.order: start-first` (rolling) para não derrubar todos os clientes de uma vez.

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

**Uploads:** o serviço `atrako_web` precisa de `UPLOADS_DIR=/data/uploads` + volume `atrako_uploads`. Sem isso, `/lp-media/*` dá 404 mesmo com `publish-lp` ok. Preferir `docker stack deploy -c apps/atrako/deploy/stack.yml …` em vez de só `--image` (que pode dropar o mount).

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

### Preço ao vivo (sticky / espelhos)

No HTML do pacote, marque o elemento que deve acompanhar o checkout:

```html
<strong data-atrako-live-price="pix">R$ 0,00</strong>
<!-- opcional: data-atrako-live-price="card" -->
```

O runtime atualiza ao trocar tamanho/variante. É wiring de plataforma (não CSS de cliente).

### Checkout config (`meta.checkout`, sem rebuild)

Copy e flags do slot `<atrako-checkout>` vão no `meta.json` (não em `CheckoutForm.tsx`):

```json
"checkout": {
  "offerTitle": "Escolha o tamanho",
  "offerCta": "Continuar",
  "formTitle": "Finalize sua compra",
  "showHeadSubtitle": false,
  "showStepper": true,
  "perks": false,
  "summaryMode": "compact",
  "termsMode": "onContinue",
  "showTermsOnPayment": false,
  "showCoupon": false,
  "draftLocalStorage": true,
  "lockAddressFromCep": true,
  "backLabel": "Voltar",
  "continueToAddressLabel": "Continuar para entrega →",
  "continueToPaymentLabel": "Continuar para pagamento →",
  "payLabels": {
    "pix": "Pix",
    "card": "Cartão",
    "finalizePix": "Gerar Pix",
    "finalizeCard": "Finalizar no cartão"
  }
}
```

Omitir um campo = default do shell. Mudar só texto/flags → `publish-lp`.  
`formTitle: ""` esconde o head. Novo comportamento React/API → rebuild **uma vez** para instalar o leitor; LPs seguintes = publish.

### Skin dos slots (sem rebuild)

O CSS normal do pacote **não** entra nos widgets (proteção `:not(.atrako-slot *)`).
Para estilizar gallery / layers / checkout / form, use no `page.css`:

```css
@atrako-slots {
  .product-gallery__main { border-radius: 0; background: #fff; }
  .mattress-layers__panel { border-radius: 0; }
  .size-option.is-selected .size-check { background: var(--accent); }
}
```

Isso é prefixado com `.atrako-lp-v3` e **não** exclui `.atrako-slot`. Continua só `publish-lp` — **proibido** colocar tema de cliente em `components.css`.

## Limites

- `MAX_LP_HTML` = 120 000  
- `MAX_LP_CSS` = 100 000  

## Política de engenharia

- **Proibido** adicionar CSS/tema de um cliente em `styles/design-system/components.css` ou ramificar `page.tsx` por `slug` de produto (exceto migração temporária).
- **Obrigatório** conteúdo de LP em v3 / `lp-pages` + `publish-lp` ou Criar HTML.
- Runtime compartilhado (checkout, uploads, tracking) permanece no shell Atrako.
