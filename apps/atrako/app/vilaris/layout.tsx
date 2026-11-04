import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./vilaris.css";

export const metadata: Metadata = {
  title: "Vilaris | Mentoria de Carreira — Última turma de 2026",
  description:
    "Sua carreira não precisa avançar no improviso. Uma mentoria estratégica de aproximadamente 3 meses com Ronaldo Carneiro e Guilherme Vilanova Carneiro.",
  icons: {
    icon: "/lp/vilaris/assets/favicon.svg",
    shortcut: "/lp/vilaris/assets/favicon.svg",
  },
};

export default function VilarisLayout({ children }: { children: ReactNode }) {
  return <div className="vilaris-lp">{children}</div>;
}
