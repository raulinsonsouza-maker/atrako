# Atrako Pages — publish de LP sem rebuild

Landing pages de cliente (HTML/CSS) publicam no **banco** (`CommerceProduct.salesPage` v3) + mídia em **`/lp-media`**. O `atrako-web` só faz rebuild quando muda runtime (checkout, slots, API, auth).

## Quando usar o quê

| Mudança | Comando | Rebuild Docker? |
|---------|---------|-----------------|
| Copy, HTML, CSS, FAQ, sticky, cores da LP | `npx tsx scripts/publish-lp.ts {slug}` | **Não** |
| Imagens/vídeo novos no pacote `assets/` | mesmo publish (copia para `lp-media`) | **Não** |
| Checkout, `CheckoutForm`, novos slots React, API MP | `git push` + deploy VPS (`DEPLOY.md`) | **Sim** |
| Domínio novo do cliente | Traefik + `lp-domains.ts` (uma vez) | Sim (stack) |

## Pacote

```
apps/atrako/lp-pages/{slug}/
  meta.json      # productSlug, goal, fonts, gallery, layers, pixDiscountPercent
  page.html      # markup + <atrako-checkout|gallery|layers|form>
  page.css       # CSS sem escopo (buildSalesPageV3 aplica .atrako-lp-v3)
  assets/        # opcional; flatten → /lp-media/{slug}-…
  backup-v1.json # notas de rollback (Mood)
```

## Publish (VPS, sem rebuild)

Com o código em `/opt/apps/atrako/src` e o serviço no ar:

```bash
WEB=$(docker ps -q -f name=atrako_web | head -n1)
set -a && source /opt/apps/atrako/.env && set +a
docker run --rm --network "container:${WEB}" \
  -e DATABASE_URL -e SOCIAL_DATABASE_URL -e UPLOADS_DIR=/data/uploads \
  -v /opt/apps/atrako/src/apps/atrako:/work \
  -v atrako_uploads:/data/uploads \
  -w /work --entrypoint "" atrako-web:latest \
  npx tsx scripts/publish-lp.ts pikolin-mood
```

Local (com DB acessível):

```bash
cd apps/atrako
npx tsx scripts/publish-lp.ts pikolin-mood
npx tsx scripts/publish-lp.ts --list
```

## Aceite Mood

- Alterar `page.html` / `page.css` + publish → live em &lt; 1 min sem `docker build`
- Checkout com variantes + Pix 15%
- Rollback: `salesPage.previous` (v3) ou re-seed v1 (`backup-v1.json` / `seed-stresser-store`)

## Limites

- `MAX_LP_HTML` = 120 000 bytes  
- `MAX_LP_CSS` = 100 000 bytes  

O script reporta `underLimits` após o publish.
