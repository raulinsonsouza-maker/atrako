const { PrismaClient } = require("/app/lib/generated/prisma");
const p = new PrismaClient();
(async () => {
  const xs = await p.geoPage.findMany({ select: { slug: true, faq: true } });
  let found = 0;
  for (const x of xs) {
    const f = x.faq;
    if (Array.isArray(f)) {
      for (const q of f) {
        if (q && q.q && q.q.includes("??")) {
          console.log(x.slug, "->", q.q);
          found++;
        }
      }
    }
  }
  console.log("total ?? found:", found);
  await p.$disconnect();
})();