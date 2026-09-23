import "../symbius.css";
import { SymbiusMarketingHeader } from "@/components/symbius/SymbiusLogo";

export default function SymbiusMarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="symbius-theme font-display">
      <SymbiusMarketingHeader />
      {children}
    </div>
  );
}
