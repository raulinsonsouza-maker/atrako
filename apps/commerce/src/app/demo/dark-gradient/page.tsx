import { DarkGradientBg } from "@/components/ui/elegant-dark-pattern";
import Link from "next/link";

export default function DarkGradientDemoPage() {
  return (
    <DarkGradientBg showLights={false}>
      <div className="flex min-h-screen items-center justify-center">
        <div className="space-y-6 p-8 text-center">
          <h1 className="text-4xl font-bold text-white">Dark Gradient Background</h1>
          <p className="mx-auto max-w-md text-lg text-gray-300">
            Fundo do sistema — sem faixas de luz. Gradiente, textura e pontos.
          </p>
          <Link
            href="/"
            className="inline-flex rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white no-underline backdrop-blur hover:bg-white/15"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    </DarkGradientBg>
  );
}
