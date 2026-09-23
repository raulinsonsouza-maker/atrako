# Engenharia Atrako — padrões

## Objetivos

Código **simples, comentado, seguro**, fácil de manter. Sem lixo nem duplicata.

## Regras

1. Um arquivo = uma responsabilidade.  
2. Comentário no topo do módulo (o quê, o que não fazer, link doc).  
3. Comentar o **porquê** em auth, webhooks, encrypt — não o óbvio.  
4. Credenciais só em `credentialsEnc`; nunca logar tokens.  
5. Toda query de domínio filtra `workspaceId` / `clienteId`.  
6. Integrações só em `lib/integrations/*`; config só em `lib/config/*`.  
7. Ao absorver módulo: copiar o que funciona, **apagar** o resto.  
8. Preferir helpers únicos a cinco cópias quase iguais.

## Cabeçalho de integração (obrigatório)

```ts
/**
 * Mercado Pago — OAuth + pagamentos do workspace.
 * Tokens: WorkspaceConnection provider=MERCADO_PAGO (via Config).
 * Doc: https://www.mercadopago.com.br/developers/pt/docs
 * Nunca gravar access_token em texto puro; usar credentialsEnc.
 */
```

## Smoke checklist

- [ ] Login  
- [ ] `/config` carrega workspace  
- [ ] Conectar MP/IG (ou status ausente claro)  
- [ ] Criar lead em `/crm`  
- [ ] Ver `/finance`  
- [ ] Abrir `/agenda`, `/commerce`, `/social` sem iframe  

## Segurança

- Webhooks: validar assinatura antes de mutar.  
- OAuth: state + expiry.  
- Config/conexões: só OWNER/ADMIN.  
- RBAC: OWNER | ADMIN | OPERATOR | ANALYST.
