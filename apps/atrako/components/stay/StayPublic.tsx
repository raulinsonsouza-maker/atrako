"use client";

import { useEffect, useMemo, useState } from "react";
import { StayCheckout } from "@/components/stay/StayCheckout";
import { StayHero } from "@/components/stay/StayHero";
import { eachNight, formatBrDate, monthCells, quoteStay } from "@/lib/stay/nights";
import "@/app/estadia/stay-public.css";

const WEEK = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

type Property = {
  slug: string;
  name: string;
  headline: string | null;
  story: string | null;
  concept: string | null;
  photos: Array<{ src: string; alt: string }>;
  features: Array<{ title: string; text: string }>;
  highlights: Array<{ value: string; label: string }>;
  nightlyCents: number;
  cleaningFeeCents: number;
  minNights: number;
  maxNights: number;
  checkInTime: string;
  checkOutTime: string;
  acceptingBookings: boolean;
  heroFrameCount: number;
};

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function nightLabel(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const label = new Date(Date.UTC(y, m - 1, d))
    .toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })
    .replace(/\./g, "");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function StayPublic({ slug }: { slug: string }) {
  const [property, setProperty] = useState<Property | null>(null);
  const [occupied, setOccupied] = useState<string[]>([]);
  const [today, setToday] = useState("");
  const [missing, setMissing] = useState(false);
  const [workspaceId, setWorkspaceId] = useState("");
  const [month, setMonth] = useState("");
  const [checkIn, setCheckIn] = useState<string | null>(null);
  const [checkOut, setCheckOut] = useState<string | null>(null);
  const [guests, setGuests] = useState("2");
  const [error, setError] = useState("");
  const [step, setStep] = useState<"dates" | "pay">("dates");
  const [resumePay, setResumePay] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const raw = sessionStorage.getItem(`stay-request:${slug}`);
    if (raw) {
      try {
        const draft = JSON.parse(raw) as { checkIn?: string; checkOut?: string; guests?: string };
        if (draft.checkIn) setCheckIn(draft.checkIn);
        if (draft.checkOut) setCheckOut(draft.checkOut);
        if (draft.guests) setGuests(String(draft.guests));
      } catch {
        sessionStorage.removeItem(`stay-request:${slug}`);
      }
    }
    if (params.get("reserva") || params.get("guest") === "1") setResumePay(true);
    let cancelled = false;
    fetch(`/api/atrako/stay/public/${slug}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("missing");
        return res.json() as Promise<{ property: Property; workspaceId?: string; today: string; occupied: string[] }>;
      })
      .then((body) => {
        if (cancelled) return;
        setProperty(body.property);
        setWorkspaceId(body.workspaceId || "");
        setToday(body.today);
        setOccupied(body.occupied);
        setMonth(body.today.slice(0, 7));
      })
      .catch(() => {
        if (!cancelled) setMissing(true);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (resumePay) setStep("pay");
  }, [resumePay]);

  useEffect(() => {
    if (!property || !month || window.location.hash !== "#reserva") return;
    document.getElementById("reserva")?.scrollIntoView({ block: "start" });
  }, [property, month]);

  const busy = useMemo(() => new Set(occupied), [occupied]);
  const quote = property && checkIn && checkOut
    ? quoteStay({
        checkIn,
        checkOut,
        nightlyCents: property.nightlyCents,
        cleaningFeeCents: property.cleaningFeeCents,
        minNights: property.minNights,
        maxNights: property.maxNights,
        occupied: busy,
        today,
      })
    : null;

  function pick(date: string) {
    if (!today || date < today) return;
    const starting = !checkIn || Boolean(checkOut);
    if (starting || date <= checkIn) {
      if (busy.has(date)) return;
      setCheckIn(date);
      setCheckOut(null);
      setStep("dates");
      setError("");
      return;
    }
    const blocked = occupied.some((night) => night >= checkIn && night < date);
    if (blocked) {
      setError("Esse intervalo passa por uma noite ocupada.");
      return;
    }
    setCheckOut(date);
    setStep("dates");
    setError("");
  }

  if (missing) {
    return <main className="stay-public"><p className="wrap">Este imóvel não está disponível.</p></main>;
  }
  if (!property || !month) {
    return <main className="stay-public"><p className="wrap">Carregando o refúgio…</p></main>;
  }

  const nightPhoto = property.photos[0]?.src || "/stay/images/cabana-noite.png";
  const dayPhoto = property.photos[1]?.src || property.photos[0]?.src || "/stay/images/cabana-dia.png";
  const nights = quote?.ok && checkIn && checkOut ? eachNight(checkIn, checkOut) : [];
  const showPay = step === "pay" && (resumePay || Boolean(quote?.ok));

  function dayState(date: string) {
    if (date < today) return "past";
    if (date === checkIn) return "start";
    if (date === checkOut) return "end";
    if (checkIn && checkOut && date > checkIn && date < checkOut) return "range";
    if (busy.has(date)) return "busy";
    return "free";
  }

  function renderMonth(value: string) {
    const [year, mon] = value.split("-").map(Number);
    const cells = monthCells(year, mon);
    const monthName = new Date(Date.UTC(year, mon - 1, 1)).toLocaleDateString("pt-BR", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
    return (
      <div className="stay-month" key={value}>
        <p className="stay-month-name">{monthName}</p>
        <div className="stay-cal">
          {WEEK.map((label) => <span key={`${value}-${label}`} className="dow">{label}</span>)}
          {cells.map((date, index) => {
            if (!date) return <span key={`${value}-e-${index}`} />;
            const state = dayState(date);
            return (
              <button key={date} type="button" data-state={state} onClick={() => pick(date)} aria-label={nightLabel(date)}>
                {Number(date.slice(8))}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (showPay) {
    const nightCount = quote?.ok ? quote.nights : nights.length;
    const lodgingCents = nightCount * property.nightlyCents;
    const totalCents = quote?.ok ? quote.amountCents : lodgingCents + property.cleaningFeeCents;
    return (
      <StayCheckout
        slug={slug}
        workspaceId={workspaceId}
        property={property}
        nightPhoto={nightPhoto}
        checkIn={checkIn}
        checkOut={checkOut}
        guests={guests}
        onGuests={setGuests}
        nights={nightCount}
        lodgingCents={lodgingCents}
        totalCents={totalCents}
        onDates={() => setStep("dates")}
      />
    );
  }

  return (
    <main className="stay-public">
      <header className="site-nav">
        <a className="brand" href="#inicio">{property.name}</a>
        <a className="nav-cta" href="#reserva">Datas disponíveis</a>
      </header>
      <StayHero
        frameCount={property.heroFrameCount}
        eyebrow={property.name}
        title={property.concept || property.name}
        lead={property.headline || ""}
        fallbackSrc={nightPhoto}
      />
      <section id="conceito" className="intro wrap">
        <div className="section-label">
          <span>O conceito</span>
          <p>{property.headline}</p>
        </div>
        <div className="intro-copy">
          <h2>{property.concept || property.name}</h2>
          <p>{property.story}</p>
        </div>
        {property.highlights.length ? (
          <div className="metrics">
            {property.highlights.map((item) => (
              <div key={item.label}><strong>{item.value}</strong><span>{item.label}</span></div>
            ))}
          </div>
        ) : null}
      </section>
      <section className="image-story">
        <img src={nightPhoto} alt={property.photos[0]?.alt || property.name} />
        <div className="story-title">
          <h2>Por fora, paisagem.<br />Por dentro, <em>presença.</em></h2>
        </div>
      </section>
      <section className="features wrap">
        <div className="features-heading">
          <h2>Detalhes pensados<br />para você <em>sentir.</em></h2>
        </div>
        <div className="feature-grid">
          {property.features.map((feature, index) => (
            <article key={feature.title}>
              <span>0{index + 1}</span>
              <h3>{feature.title}</h3>
              <p>{feature.text}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="day-image">
        <img src={dayPhoto} alt={property.photos[1]?.alt || property.name} />
      </section>
      <section id="reserva" className="stay-book">
          <div className="stay-book-copy">
            <span className="eyebrow">Quando você vem</span>
            <h2>Escolha a chegada<br />e a <em>saída.</em></h2>
            <p className="stay-note">O total aparece ao lado. Neste passo ninguém cobra nada.</p>
          </div>
          <div className="stay-cal-card">
            <div className="month-nav">
              <button type="button" onClick={() => setMonth((value) => shiftMonth(value, -1))}>Anterior</button>
              <button type="button" onClick={() => setMonth((value) => shiftMonth(value, 1))}>Próximo</button>
            </div>
            <div className="stay-months">
              {renderMonth(month)}
              {renderMonth(shiftMonth(month, 1))}
            </div>
          </div>
          <aside className="stay-book-side">
            <p className="stay-rate">{brl(property.nightlyCents)} <span>a noite</span></p>
            <p className="stay-note">
              A partir de {property.minNights} noites. Chegada às {property.checkInTime}, saída às {property.checkOutTime}.
              {property.cleaningFeeCents ? ` Limpeza ${brl(property.cleaningFeeCents)}, uma vez.` : ""}
            </p>
            <div className="stay-quote">
              {nights.length && quote?.ok ? (
                <>
                  <ul>
                    <li>
                      <span>{nightLabel(checkIn!)} a {nightLabel(checkOut!)}</span>
                    </li>
                    <li>
                      <span>{quote.nights} {quote.nights === 1 ? "noite" : "noites"}</span>
                      <span>{brl(quote.nights * property.nightlyCents)}</span>
                    </li>
                    {property.cleaningFeeCents ? <li><span>Limpeza</span><span>{brl(property.cleaningFeeCents)}</span></li> : null}
                  </ul>
                  <div className="stay-quote-total">
                    <span>{quote.nights} {quote.nights === 1 ? "noite" : "noites"}</span>
                    <strong>{brl(quote.amountCents)}</strong>
                  </div>
                  <button
                    type="button"
                    className="stay-continue"
                    disabled={!property.acceptingBookings}
                    onClick={() => {
                      sessionStorage.setItem(`stay-request:${slug}`, JSON.stringify({ checkIn, checkOut, guests }));
                      setStep("pay");
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                  >
                    {property.acceptingBookings ? "Ver estas datas" : "Reservas pausadas"}
                  </button>
                  <p className="stay-reassure">Você revisa a estadia antes de pagar.</p>
                </>
              ) : (
                <p className="stay-quote-empty">
                  {checkIn ? `Chegada em ${nightLabel(checkIn)}. Agora toque o dia da saída.` : "Toque o dia em que você chega."}
                </p>
              )}
              {quote && !quote.ok ? <p className="stay-quote-error">{quote.error}</p> : null}
              {error ? <p className="stay-quote-error">{error}</p> : null}
            </div>
          </aside>
      </section>
      <footer>
        <span>{property.name}</span>
        <a href="#inicio">Voltar ao início</a>
      </footer>
    </main>
  );
}
