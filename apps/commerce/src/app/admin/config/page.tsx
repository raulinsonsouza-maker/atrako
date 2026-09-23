import { prisma } from "@/lib/prisma";
import { PixelConfigForm } from "./PixelConfigForm";

export default async function AdminConfigPage() {
  const pixel = await prisma.pixelConfig.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });

  return (
    <PixelConfigForm pixelId={pixel.pixelId ?? ""} hasToken={Boolean(pixel.capiToken)} />
  );
}
