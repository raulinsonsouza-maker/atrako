# Serviço WhatsApp Web (whatsapp-web.js)

Processo **separado** do CRM. Conecta via QR Code (WhatsApp Web), persiste sessão e troca mensagens com o CRM via HTTP.

## Premissa

- Uma sessão = um número.
- Não rode no mesmo processo do CRM.
- Preparado para futura troca por API oficial (abstração no CRM).

## Variáveis de ambiente

| Variável    | Obrigatório | Exemplo                        | Descrição                          |
|------------|-------------|--------------------------------|------------------------------------|
| `PORT`     | Não         | `4100`                         | Porta HTTP do serviço.             |
| `CRM_URL`  | Sim*        | `http://localhost:3000`        | URL base do CRM (webhooks, etc.).  |
| `TENANT_ID`| Sim*        | `uuid-do-tenant`               | ID do tenant. Mensagens entram nesse tenant. |
| `AUTH_PATH`| Não         | `.wwebjs_auth`                 | Pasta para persistir sessão.       |

\* Sem `CRM_URL`/`TENANT_ID`, o recebimento de mensagens não é enviado ao CRM.

## Instalação e execução

```bash
cd services/whatsapp-wweb
npm install
```

### Opção 1: arquivo `.env` (funciona em Windows, Linux e macOS)

Copie `.env.example` para `.env` e preencha `TENANT_ID` (e, se quiser, `PORT`, `CRM_URL`):

```
cp .env.example .env
# Edite .env: TENANT_ID=uuid-do-tenant (pegue em Configurações ou no banco)
npm start
```

### Opção 2: variáveis na linha de comando

**Linux / macOS (Bash):**
```bash
PORT=4100 CRM_URL=http://localhost:3000 TENANT_ID=seu-tenant-id npm start
```

**Windows (PowerShell):**
```powershell
$env:PORT="4100"; $env:CRM_URL="http://localhost:3000"; $env:TENANT_ID="seu-tenant-id"; npm start
```

**Windows (script):** defina `TENANT_ID` e rode:
```powershell
$env:TENANT_ID="seu-tenant-id"; .\run.ps1
```
Ou use `run.bat`: `set TENANT_ID=seu-tenant-id & run.bat`

Para múltiplos números (múltiplos tenants): rode uma instância por tenant, em portas diferentes, e em Configurações do CRM use a URL do serviço correspondente (ex. `http://localhost:4101`).

## Endpoints

- `GET /status` — `{ status, qr? }` — `status`: `disconnected` | `qr` | `ready` | `auth_failure`
- `GET /qr` — `{ qr }` — QR atual (quando `status === 'qr'`)
- `POST /send` — body `{ to, text }` — Envia mensagem. `to`: número com DDI, só dígitos.
- `GET /health` — `{ ok }`

## Fluxo de mensagens

1. **Entrada (WhatsApp → CRM)**  
   O cliente envia no WhatsApp → `message` no client → `POST` do serviço para `CRM_URL/api/webhooks/whatsapp-wweb` com `{ tenantId, phone, content, type, externalId }`. O CRM cria/associa lead, conversa e mensagem.

2. **Saída (CRM → WhatsApp)**  
   O usuário envia pelo CRM → o CRM chama `POST {wwebServiceUrl}/send` com `{ to, text }` → o serviço envia via `client.sendMessage` e responde ao CRM.

## Sessão e QR

- Na primeira execução (ou sem sessão em `AUTH_PATH`), o client emite `qr`. O CRM exibe esse QR em Configurações (canal “WhatsApp Web”).
- Após escanear, `ready` e a sessão é persistida em `AUTH_PATH`. Nas próximas subidas, o client tenta restaurar e nem sempre emite novo QR.

## Limites e riscos

- Não disparar em massa, nem automação de mensagens frias.
- WhatsApp pode bloquear números que usem clientes não oficiais.
- Para uso crítico em produção, priorize a [API oficial do WhatsApp](https://developers.facebook.com/docs/whatsapp/).
