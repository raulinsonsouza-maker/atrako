import { ReactNode } from "react";
import { LpUrgencyBar } from "@/components/marketing/LpUrgencyBar";

type LpTheme = "airfryer" | "plantas" | "bolos";

const URGENCY_BY_THEME: Record<LpTheme, string> = {
  airfryer: "Este valor das 50 receitas acaba hoje",
  plantas: "Este valor do Tratado acaba hoje",
  bolos: "Este valor acaba hoje",
};

/** Shell mínimo para LPs — sem logo/plataforma, só o produto. */
export function LpShell({
  children,
  theme = "airfryer",
  urgencyMessage,
}: {
  children: ReactNode;
  theme?: LpTheme;
  urgencyMessage?: string;
}) {
  return (
    <div data-lp data-lp-theme={theme} className="lp-root">
      <LpUrgencyBar message={urgencyMessage ?? URGENCY_BY_THEME[theme]} />
      <main className="lp-main">{children}</main>
      <footer className="lp-footer">
        <p className="lp-footer__legal">
          Pagamento seguro · <a href="/termos">Termos</a>
          {" · "}
          <a href="/privacidade">Privacidade</a>
        </p>
      </footer>
    </div>
  );
}
