# GEO Regicenter — ampliar presença em franquia

## O que foi feito

- Merge de duplicatas (`franquia-barata*`, `perguntas-antes`, `investimento-custos-suporte`) com redirect via `previousSlugs`
- Fatos alinhados a **18 unidades**
- Pilares P0/P1/P2 de franquia publicados no guia
- Perfis (iniciantes, vendas, carreira) + interior
- ~100 GeoPrompts ativos
- LP (`/`) linka para `/guia`
- IndexNow disparado após publish

## Amplificar no site institucional

No WordPress [regicenter.com](https://regicenter.com/), incluir links permanentes para:

- https://lp.regicenter.com/guia
- https://lp.regicenter.com/guia/franquia-regicenter/como-funciona
- https://lp.regicenter.com/guia/franquia-regicenter/investimento
- https://lp.regicenter.com/guia/franquia-regicenter/melhor-franquia-30-mil
- https://lp.regicenter.com/llms.txt

Menu sugerido: **Franquias → Guia / Como funciona / Investimento**.

## Medir

No container web:

```bash
node /tmp/geo-franchise-report.mjs
```

Olhar: `hitsByKind`, `topPaths`, `leadsFromGeo`, `promptsActive`.
