import type React from "react";
import { cn } from "@/lib/utils";

interface DarkGradientBgProps {
  children?: React.ReactNode;
  className?: string;
  /** Faixas cyan — desligado por padrão no sistema */
  showLights?: boolean;
}

export function DarkGradientBg({
  children,
  className,
  showLights = false,
}: DarkGradientBgProps) {
  return (
    <div className={cn("relative min-h-screen w-full overflow-hidden bg-black", className)}>
      {/* Gradiente cinza → preto */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(100% 100% at 0% 0%, rgb(46, 46, 46) 0%, rgb(0, 0, 0) 100%)",
        }}
      />

      {showLights ? (
        <div className="pointer-events-none absolute inset-0">
          <div
            className="absolute inset-0 opacity-20"
            style={{
              background: "linear-gradient(rgb(0, 207, 255) 0%, rgba(0, 207, 255, 0) 100%)",
              mask: "linear-gradient(90deg, rgba(0, 0, 0, 0) 0%, rgb(0, 0, 0) 20%, rgba(0, 0, 0, 0) 36%, rgb(0, 0, 0) 55%, rgba(0, 0, 0, 0.13) 67%, rgb(0, 0, 0) 78%, rgba(0, 0, 0, 0) 97%)",
              transform: "skewX(45deg)",
            }}
          />
          <div
            className="absolute inset-0 opacity-20"
            style={{
              background: "linear-gradient(rgb(0, 207, 255) 0%, rgba(0, 207, 255, 0) 100%)",
              mask: "linear-gradient(90deg, rgba(0, 0, 0, 0) 11%, rgb(0, 0, 0) 25%, rgba(0, 0, 0, 0.55) 41%, rgba(0, 0, 0, 0.13) 67%, rgb(0, 0, 0) 78%, rgba(0, 0, 0, 0) 97%)",
              transform: "skewX(45deg)",
            }}
          />
        </div>
      ) : null}

      {/* Textura */}
      <div
        className="pointer-events-none absolute inset-0 bg-repeat opacity-5"
        style={{
          backgroundImage:
            'url("https://cdn.21st.dev/assets/mirror/f5/f55dfc553c100e6da0ad95258a042b4100f0ff4bb03a5313d1f541984275e262.png")',
          backgroundSize: "149.76px",
        }}
      />

      {/* Pontos sutis */}
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.5) 1px, transparent 0)",
          backgroundSize: "20px 20px",
        }}
      />

      <div className="relative z-10 min-h-screen">{children}</div>
    </div>
  );
}
