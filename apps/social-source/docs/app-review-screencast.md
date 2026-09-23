# App Review — Symbius Flow (textos + roteiro de screencast)

Use este documento ao preencher a solicitação de análise no Meta Developers.

App: https://flow.symbius.com.br  
Privacy: https://flow.symbius.com.br/privacy  
Callback OAuth: `https://flow.symbius.com.br/api/symbius/auth/meta/callback`

---

## Checklist antes de gravar / enviar

- [ ] Conta Instagram Professional adicionada como **Testador do Instagram** e convite **aceito** no app Instagram
- [ ] Conta adicionada no passo **Gerar tokens de acesso** do setup da API (se disponível)
- [ ] Login Symbius funciona (signup/login)
- [ ] `/app/connect` completa até “Conectado”
- [ ] `/app/settings` mostra **foto + @username + ID**
- [ ] Dashboard mostra o mesmo card de perfil
- [ ] Inbox tem ao menos 1 conversa de teste (DM real)
- [ ] Existe 1 fluxo publicado (keyword ou comentário→DM) para demonstrar
- [ ] Credenciais de **teste Symbius** prontas para o analista (email/senha) — **nunca** senha do Instagram

---

## Roteiro do screencast (2–4 min)

Um único vídeo pode servir para as três permissões.

1. Abrir https://flow.symbius.com.br/login e entrar com a conta de teste Symbius  
2. Ir para **Conectar Instagram** → clicar **Conectar Instagram**  
3. No popup Meta/Instagram, autorizar a conta Professional (mostrar permissões)  
4. Mostrar tela de sucesso no Symbius  
5. Abrir **Configurações** e destacar foto, `@username` e ID da conta  
6. Voltar ao **Dashboard** e mostrar o card da conta conectada  
7. Abrir **Inbox**: selecionar conversa, mostrar mensagem recebida, enviar resposta manual  
8. Abrir **Fluxos**: mostrar fluxo publicado (ex.: keyword ou comentário→DM) e explicar o trigger  
9. (Ideal) No Instagram, comentar/enviar palavra-chave e voltar ao Symbius para mostrar a automação  

Legendas sugeridas em português ou inglês.

---

## `instagram_business_basic`

### Descrição (colar no Meta)

O Symbius Flow é uma plataforma SaaS de automação de atendimento no Instagram para contas profissionais. Usamos `instagram_business_basic` apenas para obter metadados básicos da conta Professional após o Business Login for Instagram (ID da conta, nome de usuário e foto de perfil), associar essa conta à organização do cliente dentro do Symbius Flow e exibir claramente qual conta está conectada nas telas Dashboard e Configurações. Essa permissão é solicitada como **permissão dependente**, necessária para o uso de `instagram_business_manage_messages` e `instagram_business_manage_comments`, que alimentam a inbox humana e as automações (respostas a DMs e a comentários). Não usamos esses dados para publicidade direcionada a usuários finais, não revendemos dados e não coletamos dados além do necessário para identificar a conta conectada e operar o produto.

### Instruções para o analista (colar no Meta)

How to test:

1. Open https://flow.symbius.com.br/login  
2. Sign in with the Symbius test account (credentials below). Do **not** use Instagram password here.  
3. Go to **Conectar Instagram** (`/app/connect`) and click **Conectar Instagram**.  
4. Complete Instagram Business Login with an Instagram Professional account.  
5. After connection, open **Configurações** (`/app/settings`) to view the connected Instagram professional profile: profile picture, username (@…) and account ID. The same profile card appears on the Dashboard (`/app`).  
6. We request `instagram_business_basic` as a **dependent permission** required by `instagram_business_manage_messages` and `instagram_business_manage_comments`.

Symbius test credentials (fill before submit):

- Email: ________________  
- Password: ________________  

Note: Please do not ask for Instagram account passwords. Use an Instagram Professional tester account already authorized for this app if needed.

---

## `instagram_business_manage_messages`

### Descrição

O Symbius Flow usa `instagram_business_manage_messages` para receber e enviar mensagens diretas (DMs) em nome da conta Professional conectada pelo cliente. Eventos de mensagem chegam via webhooks da Meta; o Symbius persiste a conversa na Inbox e pode: (1) exibir o histórico para atendimento humano; (2) enviar respostas manuais pela Inbox; (3) executar automações (fluxos por palavra-chave / boas-vindas) que enviam DMs. O valor para o usuário é centralizar atendimento e automação de Instagram Messaging em um único painel. Esta permissão depende de `instagram_business_basic` para identificar a conta Professional autorizada. Não usamos mensagens para fins não relacionados ao atendimento/automação configurada pelo cliente.

### Instruções para o analista

1. Sign in at https://flow.symbius.com.br/login with the Symbius test credentials.  
2. Ensure an Instagram Professional account is connected (`/app/connect`).  
3. Open **Inbox** (`/app/inbox`): view an existing conversation thread and send a manual reply.  
4. Optionally open **Fluxos** (`/app/flows`) and show a published keyword/welcome flow that sends Instagram DMs.  
5. `instagram_business_basic` is included as a dependent permission for this use case.

---

## `instagram_business_manage_comments`

### Descrição

O Symbius Flow usa `instagram_business_manage_comments` para receber eventos de comentários em mídia da conta Professional (via webhooks) e acionar automações configuradas pelo cliente — por exemplo, quando um comentário contém uma palavra-chave, o sistema pode iniciar um fluxo que envia uma DM (comentário→DM). O valor para o usuário é converter engajamento em comentários em conversas de atendimento de forma automatizada. Esta permissão depende de `instagram_business_basic` (identificação da conta) e tipicamente trabalha junto com `instagram_business_manage_messages` quando a ação é enviar DM. Não moderamos nem usamos comentários fora das regras/fluxos definidos pelo cliente na plataforma.

### Instruções para o analista

1. Sign in at https://flow.symbius.com.br/login with the Symbius test credentials.  
2. Ensure Instagram is connected.  
3. Open **Fluxos** (`/app/flows`) and show a published flow with trigger type comment keyword (comentário→DM).  
4. From a test Instagram account, comment the keyword on a post of the connected Professional account; then show the resulting automation/DM in Symbius Inbox when available.  
5. `instagram_business_basic` is included as a dependent permission for this use case. Required API test calls for comments should be completed in the App Dashboard before submission.

---

## Notas

- O screencast deve mostrar **foto + username** após o connect (requisito explícito do Meta para `basic`).  
- Se a foto não aparecer, use o botão **Atualizar perfil** em Configurações.  
- App Review + Advanced Access são necessários para usuários que não são testers.
