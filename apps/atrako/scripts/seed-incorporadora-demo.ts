import { prisma } from "../lib/db";
import { replaceIncorporadoraDemo } from "../lib/demo/incorporadoraDemo";

replaceIncorporadoraDemo()
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });