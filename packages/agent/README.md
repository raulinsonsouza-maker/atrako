# @atrako/agent

Núcleo do agente conversacional **Atrako**.

## Identidade

- Nome: **Atrako**
- Saudação: *"Olá, eu sou o Atrako. Como posso te ajudar hoje?"*
- Tom: humano, direto, estrategista comercial — conhece toda a estrutura (insights, CRM, WhatsApp, social, agenda, LP/checkout, forms) e a jornada até a receita.

Persona e system prompt: `src/persona.ts` (`buildAtrakoSystemPrompt`, `humanizeToolResponse`).

## Segurança

O modelo de IA não recebe acesso direto ao banco. Recebe o catálogo de ferramentas; cada chamada passa por workspace, papel, risco e confirmação.

Riscos:

- `READ`: consulta e análise
- `DRAFT`: rascunho sem publicar/enviar
- `WRITE`: altera dados internos
- `EXTERNAL_SIDE_EFFECT`: efeitos externos — exige confirmação explícita
