import { DarkGradientBg } from "@/components/ui/elegant-dark-pattern";

export default function HomePage() {
  return (
    <DarkGradientBg showLights={false}>
      <div data-theme="admin" className="min-h-screen" aria-hidden />
    </DarkGradientBg>
  );
}
