# Liberação do InPilot em produção

## Estado seguro inicial

O InPilot usa quatro travas cumulativas:

1. rollout global;
2. usuário interno incluído no piloto;
3. cliente incluído na allowlist ou modo explícito de todos os clientes;
4. `inPilotEnabled` ativo no cadastro do cliente.

Se a configuração de rollout estiver ausente ou inválida, o acesso fica desligado.
O portal externo nunca recebe o painel ou os campos administrativos do InPilot.

## Publicação e migração

1. Confirmar que typecheck, testes do analista e build passaram.
2. Publicar pelo fluxo padrão do Replit.
3. Revisar o diff de schema exibido na publicação. As mudanças esperadas são:
   - criação de `InternalUser` e `AuditLog`;
   - campos locais de username, senha, bloqueio e último acesso em `InternalUser`;
   - criação de `InternalSession` com apenas o digest do token;
   - vínculos de auditoria por `actorInternalUserId`/`targetInternalUserId`;
   - vínculo opcional `AnalystConversation.ownerUserId`;
   - campos comerciais e `inPilotEnabled` em `Cliente`;
   - `AnalystMessage.durationMs`.
4. Não aceitar exclusão ou renomeação inesperada de tabelas ou colunas.
5. Após a publicação, confirmar que o portal externo continua acessível e que uma
   página interna anônima redireciona para o login.

## Primeiro administrador

A autenticação interna usa somente username e senha locais. Não há convites,
e-mail obrigatório ou cadastro público.

1. Definir temporariamente, apenas em produção, os três segredos:
   - `INTERNAL_AUTH_BOOTSTRAP=true`;
   - `INTERNAL_BOOTSTRAP_USERNAME` com um username normalizado (3–40 caracteres);
   - `INTERNAL_BOOTSTRAP_PASSWORD` com uma senha forte de pelo menos 12 caracteres.
   - Se já houver registros `InternalUser` legados, definir também
     `INTERNAL_BOOTSTRAP_LEGACY_USER_ID` com o ID exato de um único administrador
     ativo sem username e sem passwordHash. Esse caminho preserva o ID e todos
     os vínculos de conversas; nunca escolhe uma linha automaticamente.
2. Publicar/reiniciar a produção com essas variáveis.
3. Entrar em `/sign-in` usando exatamente esse username e senha. O sistema cria
   somente o primeiro `ADMIN`, sob trava transacional, e registra a ação na auditoria.
4. Remover **imediatamente** todas as variáveis de bootstrap do ambiente e do
   gerenciador de segredos. Nunca as deixe definidas em produção após a criação
   do administrador.
5. Em **Administração → Usuários**, criar os demais usuários com username, nome,
   perfil e uma senha forte. Ela passa a valer imediatamente e pode ser redefinida
   depois pelo administrador.

Senhas nunca são enviadas por e-mail, gravadas em logs ou retornadas pelas APIs.
O logout, redefinição de senha e desativação revogam as sessões existentes.
Defina também `SESSION_SECRET` como um segredo aleatório de produção; ele é usado
para HMAC dos buckets de limitação de login e nunca é retornado ao cliente.
As tentativas são controladas no próprio registro do usuário (cinco falhas em
15 minutos bloqueiam por 15 minutos) com trava transacional. Antes do KDF,
há buckets DB de 15 minutos com apenas HMACs: quando o IP confiável do proxy
Replit está disponível, há limites de 30 tentativas por IP e 8 por IP+username;
sem IP confiável, o bucket IP é omitido e fica apenas o limite de 8 por
username. Assim o estado funciona em todas as réplicas sem armazenar IP,
username ou senha em claro e sem confiar em cabeçalhos de proxy não validados.

## Liberação controlada

1. Abrir **Uso do InPilot**.
2. Manter o rollout global desligado enquanto seleciona usuários e o modo de clientes.
3. Selecionar o grupo inicial de usuários internos.
4. Para liberação geral, ativar **Todos os clientes atuais e futuros**. O switch
   individual continua sendo uma trava por cliente; novos clientes nascem com ele ativo.
5. Salvar a configuração.
6. Ativar o rollout global e confirmar a ativação.
7. Se outro administrador alterar o rollout enquanto a tela estiver aberta, o
   salvamento será recusado por revisão desatualizada; recarregar a configuração
   antes de tentar novamente.

## Testes da liberação

- Entrar com dois usuários internos em navegadores diferentes.
- Criar uma conversa com cada usuário e confirmar que um não enxerga a conversa do outro.
- Retomar a mesma conversa do mesmo usuário em outro navegador.
- Alternar entre dois clientes e fazer perguntas equivalentes; conferir nomes,
  períodos, fontes e contexto comercial retornados.
- Validar contas com Meta, Google, CRM e Analytics presentes e ausentes.
- Validar pelo menos uma conta de vendas e uma de geração de leads.
- Criar um cliente de teste, preencher contexto comercial e validar que o modo
  de todos os clientes o libera automaticamente.
- Abrir o portal externo desse cliente e confirmar que o InPilot não aparece.
- Confirmar que um usuário fora da allowlist recebe recurso indisponível e que
  desligar o switch individual bloqueia um cliente específico.

## Monitoramento

Em **Uso do InPilot**, acompanhar por usuário e cliente:

- volume e sucessos/erros;
- tokens e custo estimado;
- latência média.

Usar os registros de auditoria para alterações de usuários e mudanças no rollout.
Negações individuais de acesso não geram um registro de auditoria; acompanhar o
comportamento do rollout pelos indicadores de uso acima e pelas respostas de
recurso indisponível durante o teste do piloto.

## Rollback

O rollback não exige novo deploy:

1. Em **Uso do InPilot**, desligar o rollout global e salvar.
2. Confirmar que o painel desapareceu para um usuário piloto e que a API responde
   como recurso indisponível.
3. Se necessário, desativar usuários internos ou desligar `inPilotEnabled` em
   clientes específicos.
4. Não apagar conversas, usuários, campos comerciais ou migrações.
5. Confirmar que dashboards internos e portais externos continuam funcionando.