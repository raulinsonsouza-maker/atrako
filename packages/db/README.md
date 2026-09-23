# @atrako/db

Schema canonico inicial do Atrako em PostgreSQL.

Este schema cobre identidade, workspace, contatos, leads, campanhas, sessoes de tracking, eventos, integracoes, auditoria e outbox. Agenda, checkout, e-commerce, WhatsApp e Social entram como bounded contexts em migrations posteriores.

Nunca coloque credenciais em texto puro. `IntegrationConnection.credentialsEnc` deve receber payload criptografado por um servico de segredos antes de qualquer ambiente produtivo.
