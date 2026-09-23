---
name: IG API v22.0 demographics migration
description: Como migrar audience_gender_age/audience_city para follower_demographics na v22.0 da Graph API
---

## Regra
`audience_gender_age` e `audience_city` foram removidos na v22.0. Usar `follower_demographics` com:
- `metric_type=total_value` (obrigatório — sem ele retorna erro #100)
- `breakdown=age,gender` ou `breakdown=city`
- `period=lifetime` (continua funcional)
- `timeframe=last_30_days` (opcional, com fallback sem timeframe)

## Formato de resposta
```
data[0].total_value.breakdowns[0].results[{ dimension_values: [age, gender], value: N }]
```
**Importante:** `dimension_values` é `[age, gender]` (nesta ordem) — não `[gender, age]`.
Ou seja: `dimension_values[0]` = faixa etária ("25-34"), `dimension_values[1]` = gênero ("F"/"M").

**Why:** A API retorna os valores na mesma ordem que `dimension_keys`, que é `["age", "gender"]` quando `breakdown=age,gender`.

## How to apply
Ao usar `follower_demographics?breakdown=age,gender`:
```js
const [age, gender] = r.dimension_values; // age first, then gender
if (gender === "F") genero.F += r.value;
else if (gender === "M") genero.M += r.value;
else genero.U += r.value;
faixaEtaria[age] = (faixaEtaria[age] ?? 0) + r.value;
```
