"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { captureFirstTouch } from "@/lib/geo-hub/first-touch";

export const CONSENT_KEY = "atk_consent";

type Consent = "granted" | "denied" | null;

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

function readConsent(): Consent {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}

function loadPixel(pixelId: string) {
  if (window.fbq) return;
  /* eslint-disable */
  // Snippet oficial da Meta.
  (function (f: any, b: Document, e: string, v: string) {
    if (f.fbq) return;
    const n: any = (f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    });
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = true;
    n.version = "2.0";
    n.queue = [];
    const t = b.createElement(e) as HTMLScriptElement;
    t.async = true;
    t.src = v;
    const s = b.getElementsByTagName(e)[0];
    s.parentNode!.insertBefore(t, s);
  })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
  /* eslint-enable */
  window.fbq!("init", pixelId);
  window.fbq!("track", "PageView");
}

function loadGa4(measurementId: string) {
  if (window.gtag) return;
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", measurementId);
}

/** Banner de cookies + carga do Pixel/GA4 só depois do aceite. A API de Conversões segue pelo servidor. */
export function GeoConsent({
  pixelId,
  ga4Id,
  privacyHref,
}: {
  pixelId?: string | null;
  ga4Id?: string | null;
  privacyHref: string;
}) {
  const [consent, setConsent] = useState<Consent>("granted");

  useEffect(() => {
    captureFirstTouch();
    setConsent(readConsent());
  }, []);

  useEffect(() => {
    if (consent !== "granted") return;
    if (pixelId) loadPixel(pixelId);
    if (ga4Id) loadGa4(ga4Id);
  }, [consent, pixelId, ga4Id]);

  if (!pixelId && !ga4Id) return null;
  if (consent) return null;

  const choose = (value: "granted" | "denied") => {
    try {
      localStorage.setItem(CONSENT_KEY, value);
    } catch {
      /* ignore */
    }
    setConsent(value);
  };

  return (
    <div role="dialog" aria-live="polite" aria-label="Cookies" className="geo-consent">
      <p className="type-caption text-[var(--ink-muted-80)]">
        Usamos cookies de medição (Meta e Google) para entender de onde vêm as visitas. Você escolhe.{" "}
        <Link href={privacyHref} className="text-[var(--primary)]">
          Como usamos seus dados
        </Link>
      </p>
      <div className="geo-consent-actions">
        <Button variant="outline" size="toolbar" onClick={() => choose("denied")}>
          Recusar
        </Button>
        <Button variant="primary" size="toolbar" onClick={() => choose("granted")}>
          Aceitar
        </Button>
      </div>
    </div>
  );
}
