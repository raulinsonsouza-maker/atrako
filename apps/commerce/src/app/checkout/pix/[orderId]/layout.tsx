import { Outfit, Figtree, Cormorant_Garamond, Manrope } from "next/font/google";

const lpDisplay = Outfit({
  subsets: ["latin"],
  variable: "--font-lp-display",
  weight: ["600", "700", "800"],
});

const lpSans = Figtree({
  subsets: ["latin"],
  variable: "--font-lp-sans",
  weight: ["400", "500", "600", "700"],
});

const lpSerif = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-lp-serif",
  weight: ["500", "600", "700"],
});

const lpBody = Manrope({
  subsets: ["latin"],
  variable: "--font-lp-body",
  weight: ["400", "500", "600", "700"],
});

/** Mesmas fontes das LPs — a página PIX precisa parecer continuação do produto. */
export default function PixCheckoutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${lpDisplay.variable} ${lpSans.variable} ${lpSerif.variable} ${lpBody.variable}`}
    >
      {children}
    </div>
  );
}
