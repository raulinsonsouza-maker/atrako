# Configuração de UTMs na Landing Page → CV CRM

## O que isso faz

Quando um lead chega pela landing page via anúncio (Meta Ads ou Google Ads), a URL contém parâmetros UTM como:
```
https://seusite.com.br/?utm_source=facebook&utm_medium=cpc&utm_campaign=arboreto_q2&utm_content=AD03
```

Com essa configuração, o CV CRM armazena esses dados por lead — permitindo saber **exatamente qual campanha, conjunto de anúncios e criativo** originou cada lead que entrou no funil.

## Pré-requisito

A landing page precisa:
1. Ler os UTM params da URL ao carregar
2. Passar para o CV CRM via `campos_adicionais` no momento do cadastro do lead

## Implementação na Landing Page

### 1. Ler UTMs da URL

```javascript
function getUtmParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    utm_source:   params.get('utm_source')   || '',
    utm_medium:   params.get('utm_medium')   || '',
    utm_campaign: params.get('utm_campaign') || '',
    utm_content:  params.get('utm_content')  || '',
    utm_term:     params.get('utm_term')     || '',
    fbclid:       params.get('fbclid')       || '',
    gclid:        params.get('gclid')        || '',
  };
}
```

> **Dica:** Salve os UTMs no `sessionStorage` ao carregar a página, para recuperar no submit do form mesmo que o usuário navegue.
> ```javascript
> // Ao carregar: salva UTMs
> const utms = getUtmParams();
> if (utms.utm_source) sessionStorage.setItem('utms', JSON.stringify(utms));
> 
> // No submit: recupera UTMs
> const utms = JSON.parse(sessionStorage.getItem('utms') || '{}');
> ```

### 2. Enviar ao CV CRM

No payload do `POST /api/v1/comercial/leads`, inclua `campos_adicionais`:

```json
{
  "nome": "João Silva",
  "email": "joao@email.com",
  "telefone": "11999999999",
  "campos_adicionais": [
    { "idcampo": "utm_source",   "idcampo_valores": "facebook" },
    { "idcampo": "utm_medium",   "idcampo_valores": "cpc" },
    { "idcampo": "utm_campaign", "idcampo_valores": "arboreto_q2_escala" },
    { "idcampo": "utm_content",  "idcampo_valores": "AD03-estatico-mirante4" },
    { "idcampo": "utm_term",     "idcampo_valores": "" },
    { "idcampo": "fbclid",       "idcampo_valores": "AbCdEf..." }
  ]
}
```

> **Apenas campos com valor preenchido** precisam ser incluídos.

## Configuração de UTMs no Meta Ads

No Gerenciador de Anúncios, para cada anúncio com destaque para a landing page:

**URL de destino:**
```
https://seusite.com.br/?utm_source=facebook&utm_medium=cpc&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&utm_term={{adset.name}}
```

Usando as variáveis dinâmicas do Meta:
| Variável | O que captura |
|---|---|
| `{{campaign.name}}` | Nome da campanha |
| `{{adset.name}}` | Nome do conjunto de anúncios |
| `{{ad.name}}` | Nome do anúncio (criativo) |
| `{{ad.id}}` | ID do anúncio |

## O que o sistema faz após a configuração

1. O sync diário do CV CRM captura `campos_adicionais` de cada lead
2. Os UTMs são extraídos e salvos em `LeadCrm.dadosCv.utmCampaign`, `.utmContent`, etc.
3. Na aba CRM → Análise de Origem, aparecem:
   - Seção **"Por Criativo (Meta)"** com leads/vendas por anúncio
   - Colunas `utm_campaign` e `utm_content` no detalhe por lead

## Cobertura atual

Para leads de Meta Lead Form (Formulário de cadastro nativo do Meta):
- A atribuição já é automática via **Meta Lead ID Matching** (não requer configuração de UTM)
- Cobertura: ~95% dos leads de Facebook Ads

Para leads de **landing page** (link externo no anúncio):
- Requer a configuração acima para obter atribuição por criativo
- Sem a configuração, o sistema identifica apenas que veio de "Facebook Ads" / "Google"
