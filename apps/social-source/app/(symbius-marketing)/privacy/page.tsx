import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Política de Privacidade",
  description:
    "Como o Symbius Flow coleta, usa e protege dados ao conectar Instagram e automatizar mensagens.",
};

const UPDATED_AT = "25 de agosto de 2026";

const SECTIONS = [
  { id: "quem", title: "1. Quem somos" },
  { id: "escopo", title: "2. Escopo desta política" },
  { id: "dados", title: "3. Dados que coletamos" },
  { id: "meta", title: "4. Integração com Meta / Instagram" },
  { id: "uso", title: "5. Como usamos os dados" },
  { id: "base", title: "6. Base legal (LGPD)" },
  { id: "compartilhamento", title: "7. Compartilhamento" },
  { id: "retencao", title: "8. Retenção e exclusão" },
  { id: "seguranca", title: "9. Segurança" },
  { id: "direitos", title: "10. Seus direitos" },
  { id: "cookies", title: "11. Cookies e sessão" },
  { id: "criancas", title: "12. Crianças e adolescentes" },
  { id: "alteracoes", title: "13. Alterações" },
  { id: "contato", title: "14. Contato" },
] as const;

export default function PrivacyPage() {
  return (
    <main className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(124,92,255,0.14),_transparent_55%)]" />

      <div className="relative mx-auto max-w-3xl px-4 py-14 sm:py-20">
        <p className="text-sm font-medium text-[var(--symbius-accent)]">
          Symbius Flow
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
          Política de Privacidade
        </h1>
        <p className="mt-4 text-[var(--symbius-muted)]">
          Última atualização: {UPDATED_AT}
        </p>
        <p className="mt-6 text-lg leading-relaxed text-[var(--symbius-muted)]">
          Esta política explica de forma clara como o{" "}
          <span className="text-[var(--symbius-text)]">Symbius Flow</span>{" "}
          trata dados pessoais e de negócios quando você cria uma conta,
          conecta o Instagram via Meta e usa automações de mensagens e
          comentários.
        </p>

        <nav className="symbius-card mt-10">
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--symbius-muted)]">
            Conteúdo
          </p>
          <ol className="mt-4 grid gap-2 sm:grid-cols-2">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="text-sm text-[var(--symbius-text)]/90 transition-colors hover:text-[var(--symbius-primary)]"
                >
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="prose-symbius mt-12 space-y-12 text-[15px] leading-7 text-[var(--symbius-muted)]">
          <section id="quem" className="scroll-mt-24">
            <h2 className="text-xl font-bold text-[var(--symbius-text)]">
              1. Quem somos
            </h2>
            <p className="mt-4">
              O Symbius Flow é uma plataforma de automação de Instagram
              (mensagens diretas, respostas a comentários, fluxos e inbox)
              operada sob a marca Symbius / Gerenciamento Prospectads.
            </p>
            <p className="mt-3">
              Site do produto:{" "}
              <a
                href="https://flow.symbius.com.br"
                className="text-[var(--symbius-primary)] hover:underline"
              >
                https://flow.symbius.com.br
              </a>
            </p>
            <p className="mt-3">
              Contato de privacidade:{" "}
              <a
                href="mailto:ltcgalloni@gmail.com"
                className="text-[var(--symbius-primary)] hover:underline"
              >
                ltcgalloni@gmail.com
              </a>
            </p>
          </section>

          <section id="escopo" className="scroll-mt-24">
            <h2 className="text-xl font-bold text-[var(--symbius-text)]">
              2. Escopo desta política
            </h2>
            <p className="mt-4">
              Aplica-se a visitantes da landing page, usuários cadastrados
              (organizações e membros) e dados processados em nome do
              cliente quando a conta Instagram Professional é conectada à
              plataforma (incluindo mensagens e comentários recebidos via
              APIs da Meta).
            </p>
          </section>

          <section id="dados" className="scroll-mt-24">
            <h2 className="text-xl font-bold text-[var(--symbius-text)]">
              3. Dados que coletamos
            </h2>
            <ul className="mt-4 list-disc space-y-2 pl-5">
              <li>
                <strong className="text-[var(--symbius-text)]">Conta:</strong>{" "}
                nome, e-mail, senha (armazenada de forma criptografada/hash),
                nome da organização e plano.
              </li>
              <li>
                <strong className="text-[var(--symbius-text)]">Uso do produto:</strong>{" "}
                fluxos de automação, tags, configurações, logs técnicos e
                registros de execução.
              </li>
              <li>
                <strong className="text-[var(--symbius-text)]">Instagram / Meta (após autorização):</strong>{" "}
                identificadores da Página e da conta Instagram Professional,
                tokens de acesso, nome de usuário, foto de perfil quando
                disponível, mensagens e metadados de conversas, comentários
                relevantes a automações e eventos de webhook.
              </li>
              <li>
                <strong className="text-[var(--symbius-text)]">Contatos finais:</strong>{" "}
                Instagram-scoped IDs (IGSID), nomes/usernames quando a API
                fornecer, conteúdo das mensagens trocadas e tags atribuídas
                pelo cliente.
              </li>
              <li>
                <strong className="text-[var(--symbius-text)]">Técnicos:</strong>{" "}
                endereço IP, tipo de navegador, data/hora de acesso e cookies
                de sessão necessários ao login.
              </li>
            </ul>
          </section>

          <section id="meta" className="scroll-mt-24">
            <h2 className="text-xl font-bold text-[var(--symbius-text)]">
              4. Integração com Meta / Instagram
            </h2>
            <p className="mt-4">
              Para conectar sua conta, usamos o Login da Meta (Facebook Login
              for Business / produtos Instagram e Messaging). Você autoriza
              explicitamente as permissões solicitadas na tela da Meta.
            </p>
            <p className="mt-3">
              Processamos dados obtidos pelas APIs oficiais da Meta somente
              para prestar o serviço de automação e inbox que você
              configurou. Não vendemos listas de contatos. O uso também está
              sujeito aos termos e políticas da Meta / Instagram.
            </p>
            <p className="mt-3">
              Você pode revogar o acesso a qualquer momento nas configurações
              da conta Meta e/ou desconectando a conta dentro do Symbius Flow.
            </p>
          </section>

          <section id="uso" className="scroll-mt-24">
            <h2 className="text-xl font-bold text-[var(--symbius-text)]">
              5. Como usamos os dados
            </h2>
            <ul className="mt-4 list-disc space-y-2 pl-5">
              <li>Criar e autenticar sua conta e organização</li>
              <li>Conectar e manter a integração Instagram / Página</li>
              <li>Executar automações (keywords, boas-vindas, comentário→DM, etc.)</li>
              <li>Exibir e operar a inbox humana</li>
              <li>Aplicar limites de plano e suporte técnico</li>
              <li>Melhorar estabilidade, segurança e prevenção a abuso</li>
              <li>Cumprir obrigações legais quando exigido</li>
            </ul>
          </section>

          <section id="base" className="scroll-mt-24">
            <h2 className="text-xl font-bold text-[var(--symbius-text)]">
              6. Base legal (LGPD)
            </h2>
            <p className="mt-4">
              Tratamos dados com base em: (a) execução de contrato / prestação
              do serviço solicitado; (b) consentimento, quando aplicável
              (ex.: autorização OAuth Meta); (c) legítimo interesse para
              segurança e melhoria do produto, observando seus direitos; e
              (d) cumprimento de obrigação legal ou regulatória.
            </p>
            <p className="mt-3">
              Quando o cliente usa o Symbius Flow para falar com seus
              seguidores, o cliente é, em regra, o controlador desses dados
              de conversa; o Symbius Flow atua como operador/processador
              conforme as instruções e configurações do cliente.
            </p>
          </section>

          <section id="compartilhamento" className="scroll-mt-24">
            <h2 className="text-xl font-bold text-[var(--symbius-text)]">
              7. Compartilhamento
            </h2>
            <p className="mt-4">
              Não vendemos dados pessoais. Podemos compartilhar dados apenas
              com:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>
                <strong className="text-[var(--symbius-text)]">Meta Platforms:</strong>{" "}
                para autenticação e funcionamento das APIs Instagram/Messenger
              </li>
              <li>
                Provedores de infraestrutura (hospedagem, banco de dados,
                e-mail transacional) sob obrigação de confidencialidade
              </li>
              <li>
                Autoridades, quando houver obrigação legal válida
              </li>
            </ul>
          </section>

          <section id="retencao" className="scroll-mt-24">
            <h2 className="text-xl font-bold text-[var(--symbius-text)]">
              8. Retenção e exclusão
            </h2>
            <p className="mt-4">
              Mantemos dados enquanto a conta estiver ativa e pelo tempo
              necessário para prestar o serviço, cumprir obrigações legais ou
              resolver disputas. Mensagens e eventos podem ser retidos
              conforme o uso do produto e políticas da Meta (incluindo
              obrigações de exclusão quando a Meta notificar).
            </p>
            <p className="mt-3">
              Para solicitar exclusão da conta e dos dados associados, envie
              um e-mail para{" "}
              <a
                href="mailto:ltcgalloni@gmail.com"
                className="text-[var(--symbius-primary)] hover:underline"
              >
                ltcgalloni@gmail.com
              </a>{" "}
              com o assunto “Exclusão de dados — Symbius Flow”. Responderemos
              em prazo razoável, observado o LGPD.
            </p>
          </section>

          <section id="seguranca" className="scroll-mt-24">
            <h2 className="text-xl font-bold text-[var(--symbius-text)]">
              9. Segurança
            </h2>
            <p className="mt-4">
              Adotamos medidas técnicas e organizacionais adequadas: HTTPS,
              hashing de senhas, controle de acesso por organização, tokens
              de integração armazenados de forma restrita e isolamento
              multi-tenant. Nenhum método é 100% infalível; pedimos que você
              use senha forte e proteja o acesso à conta Meta.
            </p>
          </section>

          <section id="direitos" className="scroll-mt-24">
            <h2 className="text-xl font-bold text-[var(--symbius-text)]">
              10. Seus direitos
            </h2>
            <p className="mt-4">
              Nos termos da LGPD, você pode solicitar confirmação de
              tratamento, acesso, correção, anonimização, portabilidade,
              eliminação (quando cabível), informação sobre compartilhamentos
              e revogação de consentimento. Contate-nos pelo e-mail indicado
              nesta política.
            </p>
          </section>

          <section id="cookies" className="scroll-mt-24">
            <h2 className="text-xl font-bold text-[var(--symbius-text)]">
              11. Cookies e sessão
            </h2>
            <p className="mt-4">
              Usamos cookies/sessão essenciais para manter você autenticado no
              app (`symbius_session` e correlatos de OAuth). Não utilizamos
              cookies de publicidade de terceiros na experiência principal do
              produto.
            </p>
          </section>

          <section id="criancas" className="scroll-mt-24">
            <h2 className="text-xl font-bold text-[var(--symbius-text)]">
              12. Crianças e adolescentes
            </h2>
            <p className="mt-4">
              O Symbius Flow é destinado a uso empresarial/profissional. Não
              coletamos intencionalmente dados de crianças. Se souber de
              cadastro indevido, contate-nos para remoção.
            </p>
          </section>

          <section id="alteracoes" className="scroll-mt-24">
            <h2 className="text-xl font-bold text-[var(--symbius-text)]">
              13. Alterações
            </h2>
            <p className="mt-4">
              Podemos atualizar esta política para refletir mudanças no
              produto ou na legislação. A data de “Última atualização” no topo
              indica a versão vigente. Alterações relevantes podem ser
              comunicadas por e-mail ou aviso no produto.
            </p>
          </section>

          <section id="contato" className="scroll-mt-24">
            <h2 className="text-xl font-bold text-[var(--symbius-text)]">
              14. Contato
            </h2>
            <div className="symbius-card mt-4">
              <p>
                <strong className="text-[var(--symbius-text)]">E-mail:</strong>{" "}
                <a
                  href="mailto:ltcgalloni@gmail.com"
                  className="text-[var(--symbius-primary)] hover:underline"
                >
                  ltcgalloni@gmail.com
                </a>
              </p>
              <p className="mt-2">
                <strong className="text-[var(--symbius-text)]">Produto:</strong>{" "}
                <a
                  href="https://flow.symbius.com.br"
                  className="text-[var(--symbius-primary)] hover:underline"
                >
                  flow.symbius.com.br
                </a>
              </p>
            </div>
          </section>
        </div>

        <div className="mt-16 flex flex-wrap gap-3 border-t border-[var(--symbius-border)] pt-8">
          <Link href="/" className="symbius-btn-outline text-sm">
            Voltar ao início
          </Link>
          <Link href="/signup" className="symbius-btn-primary text-sm">
            Criar conta
          </Link>
        </div>
      </div>
    </main>
  );
}
