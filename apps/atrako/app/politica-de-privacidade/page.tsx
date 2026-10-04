import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Política de Privacidade | Atrako",
  description:
    "Como a Atrako coleta, usa, compartilha e protege dados pessoais e de integrações (Meta, Google, marketplaces e demais conexões).",
};

export default function PoliticaDePrivacidadePage() {
  return (
    <LegalPage title="Política de Privacidade" updatedAt="24 de setembro de 2026">
      <p>
        Esta Política descreve como a Atrako (“nós”, “nossa plataforma”), disponível em{" "}
        <a href="https://atrako.com.br">atrako.com.br</a>, trata dados pessoais e dados de
        negócio no contexto do software de inteligência comercial, CRM, mídia, agenda, commerce e
        integrações com plataformas de terceiros.
      </p>

      <h2>1. Controlador e contato</h2>
      <p>
        O controlador dos dados tratados pela plataforma Atrako é a operação Atrako responsável pelo
        produto em <a href="https://atrako.com.br">atrako.com.br</a>. Para privacidade, solicitações
        de titulares e exclusão de dados, use{" "}
        <a href="mailto:privacidade@atrako.com.br">privacidade@atrako.com.br</a> ou a página{" "}
        <a href="/exclusao-de-dados">Exclusão de dados</a>.
      </p>

      <h2>2. Dados que podemos coletar</h2>
      <ul>
        <li>
          <strong>Conta e autenticação:</strong> nome, e-mail, credenciais de acesso, papéis e
          registros de sessão.
        </li>
        <li>
          <strong>Workspace do cliente:</strong> dados cadastrais da empresa/cliente, membros,
          configurações e conteúdos operacionais (CRM, agenda, commerce, formulários).
        </li>
        <li>
          <strong>Integrações autorizadas:</strong> tokens OAuth, IDs de conta de anúncios,
          páginas, catálogos, pedidos, leads e métricas obtidos mediante autorização do usuário nas
          plataformas conectadas (ex.: Meta/Facebook/Instagram, Google Ads/Calendar, Mercado Livre,
          Mercado Pago, Shopify, WooCommerce e similares).
        </li>
        <li>
          <strong>Uso do produto:</strong> logs técnicos, endereço IP, tipo de dispositivo/navegador
          e eventos necessários à segurança e ao funcionamento do serviço.
        </li>
      </ul>

      <h2>3. Finalidades</h2>
      <ul>
        <li>Prestação e melhoria do software Atrako (autenticação, workspaces, dashboards, CRM).</li>
        <li>
          Conectar e sincronizar contas/ads/pedidos conforme permissões concedidas pelo usuário.
        </li>
        <li>Suporte, segurança, prevenção a abuso e cumprimento de obrigações legais.</li>
        <li>Comunicação operacional relacionada à conta e ao serviço.</li>
      </ul>

      <h2>4. Bases legais (LGPD)</h2>
      <p>
        Tratamos dados com base em execução de contrato (prestação do SaaS), legítimo interesse
        (segurança e melhoria do produto, com avaliação de impacto quando cabível), consentimento
        quando exigido (ex.: certas conexões OAuth e cookies não essenciais) e cumprimento de
        obrigação legal.
      </p>

      <h2>5. Integrações Meta e terceiros</h2>
      <p>
        Ao conectar Meta (Facebook Login, Instagram, WhatsApp Business, Ads ou produtos correlatos),
        você autoriza a Atrako a receber e processar dados disponibilizados pela Meta conforme as
        permissões do app e as políticas da Meta. Não vendemos dados obtidos via Meta. O uso de
        dados de plataformas de terceiros também está sujeito aos termos dessas plataformas.
      </p>

      <h2>6. Compartilhamento</h2>
      <p>
        Podemos compartilhar dados com provedores de infraestrutura (hospedagem, banco de dados,
        e-mail transacional) estritamente para operar o serviço; com autoridades quando exigido por
        lei; e com a própria plataforma de origem quando a integração assim o exigir (ex.:
        callbacks, webhooks). Não vendemos dados pessoais.
      </p>

      <h2>7. Retenção e segurança</h2>
      <p>
        Mantemos dados pelo tempo necessário às finalidades acima, às obrigações legais e à defesa
        de direitos. Aplicamos medidas técnicas e organizacionais razoáveis (controle de acesso,
        criptografia em trânsito, segregação por workspace). Nenhum sistema é 100% seguro.
      </p>

      <h2>8. Direitos do titular</h2>
      <p>
        Nos termos da LGPD, você pode solicitar confirmação de tratamento, acesso, correção,
        anonimização, portabilidade, informação sobre compartilhamentos, revogação de consentimento
        e exclusão, quando aplicável. Use{" "}
        <a href="mailto:privacidade@atrako.com.br">privacidade@atrako.com.br</a> ou{" "}
        <a href="/exclusao-de-dados">/exclusao-de-dados</a>.
      </p>

      <h2>9. Cookies</h2>
      <p>
        Usamos cookies e tecnologias similares essenciais à autenticação e sessão. Cookies
        analíticos/marketing, se usados, serão informados e, quando exigido, sujeitos a
        consentimento.
      </p>

      <h2>10. Alterações</h2>
      <p>
        Podemos atualizar esta Política. A data no topo indica a versão vigente. Alterações
        relevantes poderão ser comunicadas no produto ou por e-mail.
      </p>
    </LegalPage>
  );
}
