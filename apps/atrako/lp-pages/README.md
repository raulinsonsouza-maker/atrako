# lp-pages — LPs de **todos** os clientes Atrako

Formato canônico da plataforma. Ver [docs/LP_PAGES.md](../docs/LP_PAGES.md).

```bash
# Novo cliente
cp -r _template meu-workspace/minha-oferta
# editar meta.json, page.html, page.css
npx tsx scripts/publish-lp.ts meu-workspace/minha-oferta

npx tsx scripts/publish-lp.ts --list
```

- `_template/` — modelo (não publica)
- `{workspace}/{slug}/` — preferido
- `pikolin-mood/` — exemplo flat (Stresser)
