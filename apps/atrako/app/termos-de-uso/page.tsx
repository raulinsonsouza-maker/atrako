import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Termos de Uso | Atrako",
  description:
    "Condições de uso da plataforma Atrako (SaaS de inteligência comercial, CRM, mídia e integrações).",
};

export default function TermosDeUsoPage() {
  return (
    <LegalPage title="Termos de Uso" updatedAt="24 de setembro de 2026">
      <p>
        Estes Termos regem o acesso e o uso da plataforma Atrako em{" "}
        <a href="https://atrako.com.br">atrako.com.br</a> e serviços correlatos. Ao criar conta,
        autenticar-se ou utilizar o produto, você concorda com estes Termos e com a{" "}
        <a href="/politica-de-privacidade">Política de Privacidade</a>.
      </p>

      <h2>1. O serviço</h2>
      <p>
        A Atrako é um software (SaaS) de inteligência comercial que pode incluir CRM, insights de
        mídia, agenda, commerce, formulários e conexões com plataformas de terceiros. O conjunto
        disponível depende do plano, workspace e módulos habilitados.
      </p>

      <h2>2. Conta e elegibilidade</h2>
      <ul>
        <li>Você declara ter capacidade legal para contratar e usar o serviço.</li>
        <li>É responsável por manter credenciais em sigilo e por atividades sob sua conta.</li>
        <li>
          Workspaces podem ter administradores e membros; o administrador é responsável pela gestão
          de acessos e dados do workspace.
        </li>
      </ul>

      <h2>3. Uso aceitável</h2>
      <p>Você se compromete a não:</p>
      <ul>
        <li>Violar leis, direitos de terceiros ou políticas das plataformas conectadas.</li>
        <li>Tentar acessar dados de outros workspaces sem autorização.</li>
        <li>Abusar da API, fazer engenharia reversa indevida ou comprometer a segurança.</li>
        <li>Enviar malware, spam ou conteúdo ilícito por meio do produto.</li>
      </ul>

      <h2>4. Integrações de terceiros</h2>
      <p>
        Conexões (Meta, Google, marketplaces, pagamentos etc.) são opcionais e dependem de
        autorização sua nas respectivas plataformas. A disponibilidade, limites e políticas dessas
        plataformas estão fora do controle da Atrako. Tokens e permissões podem expirar ou ser
        revogados a qualquer momento.
      </p>

      <h2>5. Conteúdo e dados do cliente</h2>
      <p>
        Você (ou a empresa que representa) permanece titular dos dados inseridos no workspace. Você
        nos concede licença limitada para hospedar e processar esses dados somente para prestar o
        serviço. Detalhes de privacidade estão na{" "}
        <a href="/politica-de-privacidade">Política de Privacidade</a>.
      </p>

      <h2>6. Propriedade intelectual</h2>
      <p>
        A plataforma, marcas, interfaces e código da Atrako são de nossa titularidade ou de
        licenciadores. Estes Termos não transferem propriedade intelectual além da licença de uso
        do software.
      </p>

      <h2>7. Planos, cobrança e alterações</h2>
      <p>
        Funcionalidades, limites e preços podem variar conforme contrato comercial ou plano vigente.
        Podemos modificar o produto com razoável comunicação quando a mudança for material.
      </p>

      <h2>8. Disponibilidade e isenções</h2>
      <p>
        Buscamos alta disponibilidade, mas o serviço é oferecido “como está”, podendo haver
        interrupções por manutenção, falhas de provedores ou de terceiros. Na máxima extensão
        permitida pela lei, não nos responsabilizamos por lucros cessantes ou danos indiretos
        decorrentes do uso ou da indisponibilidade do serviço.
      </p>

      <h2>9. Suspensão e encerramento</h2>
      <p>
        Podemos suspender ou encerrar o acesso em caso de violação destes Termos, risco de segurança
        ou falta de pagamento, quando aplicável. Você pode solicitar exclusão de dados conforme{" "}
        <a href="/exclusao-de-dados">/exclusao-de-dados</a>.
      </p>

      <h2>10. Lei aplicável</h2>
      <p>
        Estes Termos são interpretados conforme as leis da República Federativa do Brasil. Foro da
        comarca do estabelecimento do prestador do serviço, salvo regra de consumo em contrário.
      </p>

      <h2>11. Contato</h2>
      <p>
        Dúvidas: <a href="mailto:privacidade@atrako.com.br">privacidade@atrako.com.br</a>.
      </p>
    </LegalPage>
  );
}
