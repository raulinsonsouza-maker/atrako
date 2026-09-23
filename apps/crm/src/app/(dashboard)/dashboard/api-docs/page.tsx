import { getDashboardContext } from "@/lib/dashboard-context";
import { Card, CardHeader, CardTitle, CardContent } from "@/design/components";

export default async function ApiDocsPage() {
  const { tenantId } = await getDashboardContext();

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Documentação da API</h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          Documentação completa da API REST para integração com o sistema CRM
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Autenticação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="mb-2 font-semibold text-neutral-900 dark:text-neutral-100">API Key (Webhooks)</h3>
            <p className="mb-2 text-sm text-neutral-600 dark:text-neutral-400">
              Para webhooks, use o header <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-800">X-Api-Key</code> ou o campo <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-800">apiKey</code> no body.
            </p>
            <p className="text-sm text-neutral-500">
              Configure sua API Key em <strong>Configurações → Webhooks e Automações</strong>
            </p>
          </div>

          <div>
            <h3 className="mb-2 font-semibold text-neutral-900 dark:text-neutral-100">Sessão (Endpoints Protegidos)</h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Para endpoints protegidos, faça login em <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-800">/api/auth/login</code> primeiro. A sessão é mantida via cookies.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>POST /api/webhooks/leads</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Cria um novo lead no sistema via webhook. Ideal para integração com landing pages, Meta Lead Ads, Google Ads, etc.
          </p>

          <div>
            <h4 className="mb-2 font-semibold text-neutral-900 dark:text-neutral-100">Autenticação</h4>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Header: <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-800">X-Api-Key: sua-api-key</code>
            </p>
          </div>

          <div>
            <h4 className="mb-2 font-semibold text-neutral-900 dark:text-neutral-100">Body (JSON)</h4>
            <pre className="overflow-x-auto rounded bg-neutral-100 p-3 text-xs dark:bg-neutral-800">
{`{
  "name": "João Silva",        // obrigatório
  "email": "joao@exemplo.com",  // obrigatório
  "phone": "11999999999",       // opcional
  "origin": "META",             // opcional: META, GOOGLE, WHATSAPP, MANUAL, OUTROS
  "campaign": "black-friday",   // opcional
  "ad": "anuncio-1"             // opcional
}`}
            </pre>
          </div>

          <div>
            <h4 className="mb-2 font-semibold text-neutral-900 dark:text-neutral-100">Resposta (200 OK)</h4>
            <pre className="overflow-x-auto rounded bg-neutral-100 p-3 text-xs dark:bg-neutral-800">
{`{
  "id": "uuid",
  "name": "João Silva",
  "email": "joao@exemplo.com",
  "phone": "11999999999",
  "source": "META",
  "status": "NEW"
}`}
            </pre>
          </div>

          <div>
            <h4 className="mb-2 font-semibold text-neutral-900 dark:text-neutral-100">Exemplo (cURL)</h4>
            <pre className="overflow-x-auto rounded bg-neutral-100 p-3 text-xs dark:bg-neutral-800">
{`curl -X POST https://seu-dominio.com/api/webhooks/leads \\
  -H "Content-Type: application/json" \\
  -H "X-Api-Key: sua-api-key" \\
  -d '{
    "name": "João Silva",
    "email": "joao@exemplo.com",
    "phone": "11999999999",
    "origin": "META"
  }'`}
            </pre>
          </div>

          <div>
            <h4 className="mb-2 font-semibold text-neutral-900 dark:text-neutral-100">Exemplo (JavaScript)</h4>
            <pre className="overflow-x-auto rounded bg-neutral-100 p-3 text-xs dark:bg-neutral-800">
{`const response = await fetch('https://seu-dominio.com/api/webhooks/leads', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Api-Key': 'sua-api-key'
  },
  body: JSON.stringify({
    name: 'João Silva',
    email: 'joao@exemplo.com',
    phone: '11999999999',
    origin: 'META'
  })
});

const data = await response.json();`}
            </pre>
          </div>

          <div className="rounded-lg border border-warning-200 bg-warning-50 p-3 dark:border-warning-800 dark:bg-warning-900/20">
            <p className="text-sm font-medium text-warning-800 dark:text-warning-200">
              ⚠️ Deduplicação
            </p>
            <p className="mt-1 text-xs text-warning-700 dark:text-warning-300">
              Leads são deduplicados automaticamente por telefone (ou email se não houver telefone). Se um lead já existir, ele não será duplicado.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>POST /api/webhooks/whatsapp</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Recebe mensagens do WhatsApp via Evolution API. O tenant é identificado automaticamente pela instância configurada.
          </p>

          <div>
            <h4 className="mb-2 font-semibold text-neutral-900 dark:text-neutral-100">Body (JSON - Formato Evolution API)</h4>
            <pre className="overflow-x-auto rounded bg-neutral-100 p-3 text-xs dark:bg-neutral-800">
{`{
  "instance": "nome-da-instancia",
  "data": {
    "key": {
      "remoteJid": "5511999999999@s.whatsapp.net"
    },
    "message": {
      "conversation": "Texto da mensagem"
    }
  }
}`}
            </pre>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>POST /api/webhooks/zapi</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Recebe mensagens do WhatsApp via Z-API (ReceivedCallback). O tenant é identificado automaticamente pelo instanceId configurado. Requer HTTPS.
          </p>

          <div>
            <h4 className="mb-2 font-semibold text-neutral-900 dark:text-neutral-100">Body (JSON - Formato Z-API)</h4>
            <pre className="overflow-x-auto rounded bg-neutral-100 p-3 text-xs dark:bg-neutral-800">
{`{
  "instanceId": "A20DA9C0183A2D35A260F53F5D2B9244",
  "phone": "5544999999999",
  "fromMe": false,
  "text": { "message": "Texto da mensagem" },
  "type": "ReceivedCallback"
}`}
            </pre>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Códigos de Status HTTP</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div>
              <span className="font-semibold text-success-600">200</span> - Sucesso
            </div>
            <div>
              <span className="font-semibold text-error-600">400</span> - Requisição inválida (dados faltando ou inválidos)
            </div>
            <div>
              <span className="font-semibold text-error-600">401</span> - Não autorizado (API Key inválida ou sessão expirada)
            </div>
            <div>
              <span className="font-semibold text-error-600">404</span> - Recurso não encontrado
            </div>
            <div>
              <span className="font-semibold text-error-600">500</span> - Erro interno do servidor
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>OpenAPI Specification</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
            A especificação OpenAPI completa está disponível em:
          </p>
          <a
            href="/api-docs/openapi.json"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-600 hover:underline dark:text-primary-400"
          >
            /api-docs/openapi.json
          </a>
          <p className="mt-4 text-xs text-neutral-500">
            Você pode usar esta especificação com ferramentas como Swagger UI, Postman, Insomnia, etc.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
