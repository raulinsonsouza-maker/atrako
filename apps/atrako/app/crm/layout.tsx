import { Suspense } from "react";
import { CrmEcommerceRedirect } from "./CrmEcommerceRedirect";

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={children}>
      <CrmEcommerceRedirect>{children}</CrmEcommerceRedirect>
    </Suspense>
  );
}
