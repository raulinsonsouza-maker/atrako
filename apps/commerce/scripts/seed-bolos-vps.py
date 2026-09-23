import paramiko
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HOST = "191.252.109.144"
USER = "root"
PASSWORD = "Sucesso@2025"

REMOTE = r'''
set -e
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
cd /opt/plataforma-vendas
export DATABASE_URL="file:/opt/plataforma-vendas/data/prod.db"
node <<'NODE'
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const PIXEL = "3595042497343941";
const pdf = "Produtos/Bolos/Os-100-melhores-bolos.pdf";

(async () => {
  const salesPage = {
    headline: "100 bolos deliciosos, fáceis e testados. Para fazer em casa hoje.",
    subheadline: "Receitas caseiras prontas para assar: simples, gostosas e com ingredientes de mercado.",
    bullets: [
      "100 receitas de bolos",
      "Passo a passo fácil",
      "Receitas testadas",
      "Ingredientes de casa",
      "Acesso imediato após o PIX",
    ],
    faq: [
      { q: "O que eu recebo?", a: "O e-book digital Os 100 Melhores Bolos, com acesso na hora." },
      { q: "Dá para ler no celular?", a: "Sim. No celular, no tablet ou no computador." },
      { q: "As receitas são fáceis?", a: "Sim. Foram pensadas para o dia a dia, com preparo simples." },
    ],
  };

  const bolos = await prisma.product.upsert({
    where: { slug: "100-melhores-bolos" },
    update: {
      name: "Os 100 Melhores Bolos",
      description: "E-book com 100 receitas de bolos caseiros, fáceis e testadas. Acesso imediato em PDF.",
      status: "PUBLISHED",
      priceCents: 1990,
      maxInstallments: 1,
      coverUrl: "/produtos/capa-bolos.png",
      metaPixelId: PIXEL,
      salesPage,
    },
    create: {
      name: "Os 100 Melhores Bolos",
      slug: "100-melhores-bolos",
      description: "E-book com 100 receitas de bolos caseiros, fáceis e testadas. Acesso imediato em PDF.",
      type: "FILE",
      status: "PUBLISHED",
      priceCents: 1990,
      maxInstallments: 1,
      coverUrl: "/produtos/capa-bolos.png",
      metaPixelId: PIXEL,
      salesPage,
      files: {
        create: [
          {
            name: "Os-100-melhores-bolos.pdf",
            key: `local://${pdf}`,
            sizeBytes: 0,
            mimeType: "application/pdf",
          },
        ],
      },
    },
  });

  const existingFile = await prisma.productFile.findFirst({
    where: { productId: bolos.id, name: "Os-100-melhores-bolos.pdf" },
  });
  if (!existingFile) {
    await prisma.productFile.create({
      data: {
        productId: bolos.id,
        name: "Os-100-melhores-bolos.pdf",
        key: `local://${pdf}`,
        sizeBytes: 0,
        mimeType: "application/pdf",
      },
    });
  } else {
    await prisma.productFile.update({
      where: { id: existingFile.id },
      data: { key: `local://${pdf}` },
    });
  }

  await prisma.product.updateMany({
    where: { slug: { in: ["air-fryer-50-receitas", "100-melhores-bolos"] } },
    data: { metaPixelId: PIXEL, status: "PUBLISHED" },
  });

  await prisma.pixelConfig.upsert({
    where: { id: "default" },
    update: { pixelId: PIXEL },
    create: { id: "default", pixelId: PIXEL },
  });

  const rows = await prisma.product.findMany({
    where: { slug: { in: ["air-fryer-50-receitas", "100-melhores-bolos", "plantas-medicinais"] } },
    select: { slug: true, status: true, priceCents: true, metaPixelId: true },
  });
  console.log(JSON.stringify(rows, null, 2));
  const fs = require("fs");
  console.log("pdf_exists", fs.existsSync("/opt/plataforma-vendas/Produtos/Bolos/Os-100-melhores-bolos.pdf"));
  console.log("capa_exists", fs.existsSync("/opt/plataforma-vendas/public/produtos/capa-bolos.png"));
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
NODE

curl -s -o /dev/null -w "local_bolos:%{http_code}\n" --max-time 40 http://127.0.0.1:3010/p/100-melhores-bolos
curl -s --max-time 40 http://127.0.0.1:3010/p/100-melhores-bolos | grep -o "Os 100 Melhores Bolos\|3595042497343941\|bolo-cenoura\|Quero as 100" | head -n 10
'''

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PASSWORD, timeout=30, allow_agent=False, look_for_keys=False)
stdin, stdout, stderr = client.exec_command(REMOTE, timeout=120)
print(stdout.read().decode("utf-8", errors="replace"))
err = stderr.read().decode("utf-8", errors="replace")
if err.strip():
    print("STDERR:", err)
print("exit", stdout.channel.recv_exit_status())
client.close()
