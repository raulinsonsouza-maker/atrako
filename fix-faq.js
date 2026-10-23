const { PrismaClient } = require("/app/lib/generated/prisma");
const p = new PrismaClient();
(async () => {
  const xs = await p.geoPage.findMany({ select: { id: true, slug: true, faq: true } });
  let fixed = 0;
  for (const x of xs) {
    const f = x.faq;
    if (!Array.isArray(f)) continue;
    let changed = false;
    const newFaq = f.map((q) => {
      if (q && q.q && q.q.includes("??")) {
        changed = true;
        return { ...q, q: q.q.replace(/\?\?+$/, "?") };
      }
      return q;
    });
    if (changed) {
      await p.geoPage.update({ where: { id: x.id }, data: { faq: newFaq } });
      console.log("fixed:", x.slug);
      fixed++;
    }
  }
  console.log("total fixed:", fixed);
  await p.$disconnect();
})();