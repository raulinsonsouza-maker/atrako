const { PrismaClient } = require("/app/lib/generated/prisma");
const p = new PrismaClient();
(async () => {
  const page = await p.geoPage.findFirst({ where: { slug: "registro-de-marca" } });
  if (!page) { console.error("Page not found"); process.exit(1); }

  const newBody = `## O que é registro de marca

O registro de marca no INPI (Instituto Nacional da Propriedade Industrial) é o ato administrativo que confere ao titular o direito de uso exclusivo da marca em todo o território nacional, dentro da classe de atividade registrada.

## Etapas do processo

### 1. Pesquisa de anterioridade
Antes de protocolar, é essencial verificar se a marca já está registrada ou em tramitação. O INPI disponibiliza uma busca gratuita no portal. Uma marca similar pode inviabilizar o registro.

### 2. Preparação do pedido
Definição da classe de Nice (classificação internacional de produtos e serviços), elaboração da representação gráfica da marca e preenchimento do formulário de pedido.

### 3. Protocolo
Submissão do pedido ao INPI com o pagamento da taxa correspondente. O protocolo gera um número de processo e a data de depósito, que é importante para a prioridade do registro.

### 4. Exame formal
O INPI verifica se o pedido atende aos requisitos formais. Se houver irregularidades, é emitida uma exigência para correção.

### 5. Publicação
O pedido é publicado na Revista da Propriedade Industrial (RPI). A partir da publicação, terceiros têm 60 dias para apresentar oposição.

### 6. Exame de mérito
O INPI analisa se a marca atende aos requisitos de registrabilidade (distintividade, licitude, disponibilidade). Pode emitir exigências ou indeferir o pedido.

### 7. Concessão ou indeferimento
Se aprovado, o registro é concedido e publicado. O titular recebe o certificado de registro, válido por 10 anos, renovável.

## Custos e taxas

As taxas do INPI variam conforme a classe e o tipo de marca. Consulte a tabela de taxas atualizada no portal do INPI. Valores podem ser alterados periodicamente.

## Erros comuns

- Não realizar pesquisa de anterioridade antes de investir na marca.
- Escolher uma marca descritiva ou genérica, que o INPI pode indeferir.
- Deixar de responder a exigências dentro do prazo, causando arquivamento do pedido.
- Não monitorar a publicação para identificar oposições.

## Prazos

O prazo de análise varia conforme a classe, a carga de trabalho do INPI e a complexidade do pedido. Não há prazo garantido de concessão. Consulte o portal do INPI para informações atualizadas sobre tempos médios.

## Fontes oficiais

- INPI: https://www.gov.br/inpi/pt-br
- Lei nº 9.279/1996 (Lei da Propriedade Industrial)
- Revista da Propriedade Industrial (RPI): https://revistas.inpi.gov.br/

Data de verificação: 23/10/2026.

## Assistência da Regicenter

A Regicenter oferece assistência no processo de registro de marca junto ao INPI, desde a pesquisa de disponibilidade até o protocolo e acompanhamento administrativo. O protocolo do pedido não equivale à concessão do registro, que depende da análise do INPI e das condições legais aplicáveis.`;

  const newFaq = [
    { q: "Quanto tempo leva para registrar uma marca no INPI?", a: "O prazo varia conforme a classe e a carga do INPI. Não há prazo garantido. Consulte o portal do INPI para tempos médios atualizados." },
    { q: "Qual o custo do registro de marca?", a: "As taxas do INPI variam conforme a classe e o tipo de marca. Consulte a tabela de taxas no portal do INPI." },
    { q: "O protocolo garante a concessão do registro?", a: "Não. O protocolo inicia o processo, mas a concessão depende da análise do INPI e das condições legais." },
    { q: "Posso registrar uma marca sozinho?", a: "Sim, mas a assistência profissional reduz erros e aumenta as chances de sucesso." },
  ];

  await p.geoPage.update({
    where: { id: page.id },
    data: {
      body: newBody,
      faq: newFaq,
      updatedAt: new Date(),
    },
  });
  console.log("Enriched:", page.slug);
  await p.$disconnect();
})();