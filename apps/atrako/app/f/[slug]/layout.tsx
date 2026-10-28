import type { Metadata } from "next";
import type { ReactNode } from "react";
import { REGICENTER_QUALIFY_FORM_PATH } from "@/lib/lp-domains";

const QUALIFY_URL = `https://lp.regicenter.com${REGICENTER_QUALIFY_FORM_PATH}`;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  if (slug !== "franquia-regicenter-qualify") return {};
  const title = "Franquia Regicenter";
  const description = "Empreenda com uma franquia de marcas e patentes";
  return {
    title,
    description,
    icons: {
      icon: "/lp/regicenter-franquia/assets/favicon.png",
      apple: "/lp/regicenter-franquia/assets/apple-touch-icon.png",
    },
    alternates: { canonical: QUALIFY_URL },
    openGraph: {
      title,
      description,
      siteName: "Regicenter",
      url: QUALIFY_URL,
      type: "website",
    },
  };
}

export default function QualifyFormLayout({ children }: { children: ReactNode }) {
  return children;
}
