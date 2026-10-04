import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Exclusão de Dados | Atrako",
  description:
    "Como solicitar a exclusão dos seus dados pessoais e de conta na plataforma Atrako (requisito Meta / LGPD).",
};

export default function ExclusaoDeDadosPage() {
  return (
    <LegalPage title="Exclusão de dados" updatedAt="24 de setembro de 2026">
      <p>
        Esta página explica como solicitar a exclusão de dados pessoais e de conta associados à
        Atrako, inclusive dados obtidos via login ou integrações Meta (Facebook/Instagram), em
        conformidade com a LGPD e com as exigências de privacidade de plataformas parceiras.
      </p>

      <h2>1. O que pode ser excluído</h2>
      <ul>
        <li>Dados de perfil de usuário (nome, e-mail, sessão) vinculados à sua conta.</li>
        <li>
          Tokens e conexões OAuth (Meta, Google, marketplaces etc.) associados ao seu usuário ou ao
          workspace, conforme a solicitação.
        </li>
        <li>
          Dados operacionais do workspace (contatos, leads, configurações) quando a solicitação for
          feita pelo administrador responsável e não houver obrigação legal de retenção.
        </li>
      </ul>

      <h2>2. Como solicitar</h2>
      <p>Envie um e-mail para:</p>
      <p>
        <a href="mailto:privacidade@atrako.com.br?subject=Solicita%C3%A7%C3%A3o%20de%20exclus%C3%A3o%20de%20dados%20Atrako">
          privacidade@atrako.com.br
        </a>
      </p>
      <p>Inclua no corpo da mensagem:</p>
      <ul>
        <li>Assunto: “Solicitação de exclusão de dados Atrako”.</li>
        <li>Nome completo e e-mail usado na conta.</li>
        <li>Workspace / empresa, se aplicável.</li>
        <li>
          Escopo: (a) apenas conta de usuário; (b) desconexão de integrações Meta/outras; (c)
          exclusão completa do workspace (requer administrador).
        </li>
        <li>Confirmação de que você é o titular ou administrador autorizado.</li>
      </ul>

      <h2>3. Prazo</h2>
      <p>
        Confirmaremos o recebimento em até <strong>5 dias úteis</strong> e concluiremos a exclusão
        ou anonimização elegível em até <strong>30 dias</strong>, salvo hipótese legal de retenção
        (ex.: obrigações fiscais, defesa de direitos ou logs de segurança mínimos).
      </p>

      <h2>4. Dados de Meta / Facebook</h2>
      <p>
        Se você autorizou a Atrako via Facebook Login ou conexões Meta, a exclusão remove de nossos
        sistemas os tokens e dados sincronizados dessa conexão, na medida em que estiverem sob nosso
        controle. Você também pode revogar o acesso do app Atrako nas configurações da sua conta
        Meta/Facebook. Políticas da Meta continuam aplicáveis ao lado da Meta.
      </p>

      <h2>5. Efeitos da exclusão</h2>
      <ul>
        <li>Perda de acesso ao produto e aos dados excluídos.</li>
        <li>Integrações deixam de sincronizar até nova autorização.</li>
        <li>
          Backups podem levar um ciclo adicional para purga completa, sem uso operacional desses
          dados.
        </li>
      </ul>

      <h2>6. Mais informações</h2>
      <p>
        Consulte a <a href="/politica-de-privacidade">Política de Privacidade</a> e os{" "}
        <a href="/termos-de-uso">Termos de Uso</a>.
      </p>
    </LegalPage>
  );
}
