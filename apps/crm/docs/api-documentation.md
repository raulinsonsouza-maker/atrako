# Documentação da API REST

## Autenticação

A API utiliza autenticação baseada em sessão (cookies) ou API Key para webhooks.

### Autenticação por Sessão
Para endpoints protegidos, é necessário estar autenticado via `/api/auth/login`. A sessão é mantida via cookies.

### Autenticação por API Key (Webhooks)
Para webhooks, use o header `X-Api-Key` ou o campo `apiKey` no body.

---

## Endpoints

### Autenticação

#### POST `/api/auth/login`
Autentica um usuário e cria uma sessão.

**Body:**
```json
{
  "email": "usuario@exemplo.com",
  "password": "senha123"
}
```

**Resposta:**
```json
{
  "user": {
    "id": "uuid",
    "email": "usuario@exemplo.com",
    "name": "Nome do Usuário",
    "role": "TENANT_USER"
  }
}
```

#### POST `/api/auth/logout`
Encerra a sessão atual.

---

### Leads

#### POST `/api/webhooks/leads`
Cria um novo lead via webhook.

**Autenticação:** API Key (`X-Api-Key` header ou `apiKey` no body)

**Body:**
```json
{
  "apiKey": "sua-api-key",
  "name": "Nome do Lead",
  "email": "lead@exemplo.com",
  "phone": "11999999999",
  "origin": "META",
  "campaign": "black-friday",
  "ad": "anuncio-1"
}
```

**Campos:**
- `name` (obrigatório): Nome do lead
- `email` (obrigatório): E-mail do lead
- `phone` (opcional): Telefone do lead
- `origin` (opcional): Origem (META, GOOGLE, WHATSAPP, MANUAL, OUTROS)
- `campaign` (opcional): Nome da campanha
- `ad` (opcional): Nome do anúncio
- `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term` (opcionais): Parâmetros UTM

**Resposta:**
```json
{
  "id": "uuid",
  "name": "Nome do Lead",
  "email": "lead@exemplo.com",
  "phone": "11999999999",
  "source": "META",
  "status": "NEW"
}
```

**Deduplicação:** O sistema deduplica leads por telefone (ou email se não houver telefone).

---

### Webhooks WhatsApp

#### POST `/api/webhooks/whatsapp`
Recebe mensagens do WhatsApp via Evolution API.

**Autenticação:** Não requerida (identificação via `instance` no body)

**Body:** Formato Evolution API
```json
{
  "instance": "nome-da-instancia",
  "data": {
    "key": {
      "remoteJid": "5511999999999@s.whatsapp.net"
    },
    "message": {
      "conversation": "Texto da mensagem"
    }
  }
}
```

**Resposta:**
```json
{
  "ok": true
}
```

#### POST `/api/webhooks/whatsapp-wweb`
Recebe mensagens do WhatsApp Web integrado.

**Autenticação:** API Key (`X-Api-Key` header)

**Body:**
```json
{
  "tenantId": "uuid",
  "phone": "11999999999",
  "content": "Texto da mensagem",
  "type": "text",
  "externalId": "msg-id"
}
```

---

### Convites

#### POST `/api/invites/accept`
Aceita um convite e cria conta de usuário.

**Body:**
```json
{
  "token": "token-do-convite",
  "name": "Nome do Usuário",
  "password": "senha123"
}
```

**Resposta:**
```json
{
  "ok": true
}
```

---

## Códigos de Status HTTP

- `200` - Sucesso
- `400` - Requisição inválida (dados faltando ou inválidos)
- `401` - Não autorizado (API Key inválida ou sessão expirada)
- `404` - Recurso não encontrado
- `500` - Erro interno do servidor

---

## Exemplos de Uso

### Criar Lead via Webhook (cURL)

```bash
curl -X POST https://seu-dominio.com/api/webhooks/leads \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: sua-api-key" \
  -d '{
    "name": "João Silva",
    "email": "joao@exemplo.com",
    "phone": "11999999999",
    "origin": "META",
    "campaign": "black-friday"
  }'
```

### Criar Lead via Webhook (JavaScript)

```javascript
const response = await fetch('https://seu-dominio.com/api/webhooks/leads', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Api-Key': 'sua-api-key'
  },
  body: JSON.stringify({
    name: 'João Silva',
    email: 'joao@exemplo.com',
    phone: '11999999999',
    origin: 'META',
    campaign: 'black-friday'
  })
});

const data = await response.json();
console.log(data);
```

---

## Limitações e Considerações

1. **Rate Limiting**: Atualmente não há rate limiting implementado. Considere implementar para produção.

2. **Deduplicação**: Leads são deduplicados por telefone (ou email se não houver telefone).

3. **Multi-tenant**: Todos os endpoints são multi-tenant. O tenant é identificado via API Key ou sessão do usuário.

4. **Validação**: Campos obrigatórios são validados. E-mails devem ser válidos.

5. **Segurança**: API Keys devem ser mantidas em segredo. Use HTTPS em produção.

---

## Próximos Passos

- Implementar endpoints REST completos para CRUD de leads, oportunidades, etc.
- Adicionar paginação e filtros avançados
- Implementar rate limiting
- Adicionar versionamento da API (v1, v2, etc.)
