"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatBrDate } from "@/lib/stay/nights";

type Property = {
  name: string;
  nightlyCents: number;
  cleaningFeeCents: number;
  checkInTime: string;
  checkOutTime: string;
  acceptingBookings: boolean;
};

type Guest = {
  name: string;
  email: string | null;
  phone: string | null;
  birthDate: string | null;
  promoOptOut: boolean;
};

type Reservation = {
  token: string;
  number: number;
  status: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  amountCents: number;
  pixQrCodeBase64: string | null;
  pixCopyPaste: string | null;
  holdExpiresAt: string | null;
};

type Installment = {
  installments: number;
  installmentAmountCents: number;
  totalAmountCents: number;
  label: string;
};

type PayConfig = {
  workspaceId: string;
  mpConnected: boolean;
  publicKey: string | null;
  googleEnabled: boolean;
};

type MpSdk = {
  createCardToken: (card: Record<string, string>) => Promise<{ id: string }>;
};

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function digits(value: string) {
  return value.replace(/\D/g, "");
}

function splitName(name: string) {
  const parts = name.trim().split(/\s+/);
  return { firstName: parts[0] || "", lastName: parts.slice(1).join(" ") };
}

function loadMercadoPago(publicKey: string) {
  const w = window as Window & { MercadoPago?: new (key: string) => MpSdk };
  const ready = () => {
    if (!w.MercadoPago) throw new Error("Não foi possível abrir o cartão.");
    return new w.MercadoPago(publicKey);
  };
  if (w.MercadoPago) return Promise.resolve(ready());
  return new Promise<MpSdk>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://sdk.mercadopago.com/js/v2";
    script.onload = () => {
      try {
        resolve(ready());
      } catch (err) {
        reject(err);
      }
    };
    script.onerror = () => reject(new Error("Não foi possível abrir o cartão."));
    document.head.appendChild(script);
  });
}

function useCountdown(iso: string | null, active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active || !iso) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active, iso]);
  if (!iso) return "20:00";
  const left = Math.max(0, new Date(iso).getTime() - now);
  const minutes = Math.floor(left / 60000);
  const seconds = Math.floor((left % 60000) / 1000);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function StayCheckout({
  slug,
  workspaceId,
  property,
  nightPhoto,
  checkIn,
  checkOut,
  guests,
  onGuests,
  nights,
  lodgingCents,
  totalCents,
  onDates,
}: {
  slug: string;
  workspaceId: string;
  property: Property;
  nightPhoto: string;
  checkIn: string | null;
  checkOut: string | null;
  guests: string;
  onGuests: (value: string) => void;
  nights: number;
  lodgingCents: number;
  totalCents: number;
  onDates: () => void;
}) {
  const [phase, setPhase] = useState<"login" | "pay" | "installments" | "review" | "done">("login");
  const [modal, setModal] = useState<null | "identity" | "account" | "phone" | "pix">(null);
  const [guest, setGuest] = useState<Guest | null>(null);
  const [config, setConfig] = useState<PayConfig | null>(null);
  const [identifier, setIdentifier] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [promoOptOut, setPromoOptOut] = useState(false);
  const [method, setMethod] = useState<"pix" | "card">("pix");
  const [legalName, setLegalName] = useState("");
  const [cpf, setCpf] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [brand, setBrand] = useState("");
  const [options, setOptions] = useState<Installment[]>([]);
  const [installments, setInstallments] = useState(1);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [verificationUrl, setVerificationUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const requestId = useRef("");
  const countdown = useCountdown(reservation?.holdExpiresAt ?? null, modal === "pix");
  const expired = Boolean(
    reservation?.holdExpiresAt && new Date(reservation.holdExpiresAt).getTime() <= Date.now() && reservation.status !== "CONFIRMED",
  );

  const selected = options.find((item) => item.installments === installments) ?? options[0];
  const guestCount = Number(guests) || 1;
  const arrival = reservation?.checkIn || checkIn;
  const departure = reservation?.checkOut || checkOut;
  const nightCount = reservation?.nights || nights;
  const dueCents = reservation?.amountCents || totalCents;

  const draftKey = `stay-request:${slug}`;
  const profileName = `${firstName} ${lastName}`.trim();

  function rememberDraft() {
    sessionStorage.setItem(
      draftKey,
      JSON.stringify({ checkIn, checkOut, guests, firstName, lastName, email, phone, birthDate }),
    );
  }

  useEffect(() => {
    const key = `stay-charge:${slug}:${checkIn}:${checkOut}`;
    const saved = sessionStorage.getItem(key);
    requestId.current = saved || crypto.randomUUID();
    sessionStorage.setItem(key, requestId.current);
  }, [slug, checkIn, checkOut]);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("reserva");
    if (!token) return;
    fetch(`/api/atrako/stay/public/reservations/${token}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { reservation?: Reservation } | null) => {
        if (!body?.reservation) return;
        setReservation(body.reservation);
        setPhase(body.reservation.status === "CONFIRMED" ? "done" : "review");
        if (body.reservation.status === "PENDING_PAYMENT" && body.reservation.pixCopyPaste) setModal("pix");
      })
      .catch(() => null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/atrako/stay/public/${slug}/pay-config`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: PayConfig | null) => {
        if (!cancelled && body) setConfig(body);
      })
      .catch(() => null);
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    fetch(`/api/atrako/identity/guest?clienteId=${encodeURIComponent(workspaceId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { guest?: Guest | null } | null) => {
        if (cancelled || !body?.guest) return;
        applyGuest(body.guest);
        const back = new URLSearchParams(window.location.search).get("guest");
        if (back === "error") setError("Não foi possível entrar com o Google.");
        if (back === "1" && !body.guest.birthDate) setModal("account");
        if (body.guest.birthDate) setPhase((current) => (current === "login" ? "pay" : current));
      })
      .catch(() => null);
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  useEffect(() => {
    if (!reservation || reservation.status !== "PENDING_PAYMENT") return;
    const id = window.setInterval(() => {
      fetch(`/api/atrako/stay/public/reservations/${reservation.token}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((body: { reservation?: Reservation } | null) => {
          if (!body?.reservation) return;
          setReservation(body.reservation);
          if (body.reservation.status === "CONFIRMED") {
            setModal(null);
            setPhase("done");
          }
        })
        .catch(() => null);
    }, 4000);
    return () => window.clearInterval(id);
  }, [reservation?.token, reservation?.status]);

  function applyGuest(next: Guest) {
    setGuest(next);
    const parts = splitName(next.name);
    setFirstName(parts.firstName);
    setLastName(parts.lastName);
    setEmail(next.email || "");
    setPhone(next.phone || "");
    setBirthDate(next.birthDate || "");
    setPromoOptOut(next.promoOptOut);
    setLegalName(next.name);
    setCardName(next.name);
  }

  async function saveProfile(extra?: { phone?: string; cpf?: string }) {
    const savedPhone = extra?.phone ?? phone;
    const res = await fetch("/api/atrako/identity/guest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clienteId: workspaceId,
        firstName,
        lastName,
        email,
        phone: savedPhone,
        birthDate,
        cpf: extra?.cpf || cpf,
        promoOptOut,
        source: "stay",
      }),
    });
    const body = (await res.json().catch(() => ({}))) as { guest?: Guest; error?: string };
    if (!res.ok || !body.guest) throw new Error(body.error || "Não foi possível salvar o cadastro.");
    applyGuest(body.guest);
    if (extra?.phone) setPhone(extra.phone);
    return body.guest;
  }

  function openIdentity() {
    setError("");
    setModal("identity");
  }

  function continueIdentity() {
    const value = identifier.trim();
    if (value.includes("@")) setEmail(value);
    else if (digits(value).length >= 10) setPhone(value);
    else {
      setError("Informe um telefone ou e-mail.");
      return;
    }
    setError("");
    setModal("account");
  }

  async function continueAccount() {
    if (firstName.trim().length < 2 || !email.includes("@") || !birthDate) {
      setError("Preencha nome, e-mail e data de nascimento.");
      return;
    }
    setPending(true);
    setError("");
    try {
      await saveProfile();
      setModal(null);
      setPhase("pay");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar o cadastro.");
    } finally {
      setPending(false);
    }
  }

  function startGoogle() {
    if (!workspaceId) return;
    rememberDraft();
    const returnTo = `/estadia/${slug}?guest=1`;
    window.location.href = `/api/atrako/oauth/google/start?clienteId=${encodeURIComponent(workspaceId)}&returnTo=${encodeURIComponent(returnTo)}`;
  }

  const bin = digits(cardNumber).slice(0, 6);
  useEffect(() => {
    if (method !== "card" || bin.length < 6 || totalCents <= 0) return;
    let cancelled = false;
    fetch(`/api/atrako/stay/public/${slug}/installments?bin=${bin}&amount=${totalCents}`)
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as {
          paymentMethodId?: string;
          options?: Installment[];
          error?: string;
        };
        if (!res.ok) throw new Error(body.error || "Sem parcelas para este cartão.");
        return body;
      })
      .then((body) => {
        if (cancelled) return;
        setBrand(body.paymentMethodId || "");
        setOptions(body.options || []);
        setInstallments(body.options?.[0]?.installments ?? 1);
        setError("");
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setOptions([]);
          setBrand("");
          setError(err.message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [bin, method, slug, totalCents]);

  function continuePayment() {
    if (!config?.mpConnected) {
      setError("O pagamento ainda não está disponível neste imóvel.");
      return;
    }
    if (method === "pix") {
      if (legalName.trim().length < 5 || digits(cpf).length !== 11 || !birthDate) {
        setError("No Pix, informe nome, CPF e data de nascimento.");
        return;
      }
      setError("");
      setPhase("review");
      return;
    }
    if (digits(cardNumber).length < 13 || cardName.trim().length < 5 || digits(cardExpiry).length < 4 || digits(cardCvv).length < 3 || digits(cpf).length !== 11) {
      setError("Preencha os dados do cartão e o CPF do titular.");
      return;
    }
    if (!brand || !options.length) {
      setError("Aguarde as parcelas deste cartão.");
      return;
    }
    setError("");
    setPhase("installments");
  }

  async function submitCharge(nextPhone: string) {
    if (!checkIn || !checkOut) return;
    setPending(true);
    setError("");
    try {
      await saveProfile({ phone: nextPhone, cpf: method === "pix" ? cpf : undefined });
      const guestName = method === "pix" ? legalName.trim() : profileName;
      let cardToken = "";
      if (method === "card") {
        if (!config?.publicKey) throw new Error("O cartão precisa da chave pública do Mercado Pago.");
        const [month, year] = cardExpiry.split("/");
        const mp = await loadMercadoPago(config.publicKey);
        const token = await mp.createCardToken({
          cardNumber: digits(cardNumber),
          cardholderName: cardName.trim(),
          cardExpirationMonth: digits(month || "").padStart(2, "0"),
          cardExpirationYear: digits(year || "").length === 2 ? `20${digits(year || "")}` : digits(year || ""),
          securityCode: digits(cardCvv),
          identificationType: "CPF",
          identificationNumber: digits(cpf),
        });
        cardToken = token.id;
      }
      const res = await fetch(`/api/atrako/stay/public/${slug}/reserve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkIn,
          checkOut,
          guestName,
          guestEmail: email,
          guestPhone: nextPhone,
          guests: guestCount,
          clientRequestId: requestId.current,
          birthDate,
          payment:
            method === "pix"
              ? { method: "pix", cpf: digits(cpf) }
              : { method: "card", token: cardToken, paymentMethodId: brand, installments },
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        paymentError?: string;
        verificationUrl?: string;
        reservation?: Reservation;
      };
      if (!res.ok || !body.reservation) throw new Error(body.error || "Não foi possível criar a reserva.");
      setReservation(body.reservation);
      setVerificationUrl(body.verificationUrl || "");
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set("reserva", body.reservation.token);
      window.history.replaceState(null, "", nextUrl.toString());
      if (body.paymentError) setError(body.paymentError);
      if (body.reservation.status === "CONFIRMED") {
        setModal(null);
        setPhase("done");
      } else if (body.verificationUrl) {
        setModal(null);
        setPhase("done");
      } else if (method === "pix") {
        setPhase("review");
        setModal("pix");
      } else {
        setPhase("done");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível cobrar a reserva.");
    } finally {
      setPending(false);
    }
  }

  function confirmPay() {
    if (!accepted) {
      setError("Aceite os termos para confirmar.");
      return;
    }
    if (digits(phone).length < 10) {
      setModal("phone");
      return;
    }
    void submitCharge(phone);
  }

  const payLabel = method === "pix"
    ? "Pix à vista"
    : `Cartão ${brand || ""} · ${selected ? selected.label : `${installments}x`}`.trim();

  const loginDone = phase !== "login";
  const payDone = phase === "review" || phase === "done";
  const reviewOpen = phase === "review" || phase === "done";

  const summary = useMemo(() => ({ arrival, departure, guestCount, nightCount, dueCents }), [arrival, departure, guestCount, nightCount, dueCents]);

  return (
    <main className={modal ? "stay-public stay-confirm is-dimmed" : "stay-public stay-confirm"}>
      <div className="stay-confirm-head">
        <button type="button" className="stay-confirm-back" onClick={onDates} aria-label="Voltar às datas">←</button>
        <h2>Confirmar e pagar</h2>
      </div>
      <div className="stay-confirm-grid">
        <div>
          <section className={loginDone ? "stay-step is-done" : "stay-step"}>
            {loginDone ? (
              <div className="stay-step-row">
                <div>
                  <h3>1. Entrar ou cadastrar-se</h3>
                  <p>{profileName}{email ? ` · ${email}` : ""}</p>
                </div>
                <button type="button" className="stay-alter" onClick={() => setModal("account")}>Alterar</button>
              </div>
            ) : (
              <div className="stay-step-row">
                <h3>1. Entrar ou cadastrar-se</h3>
                <button type="button" onClick={openIdentity}>Continuar</button>
              </div>
            )}
          </section>

          <section className={phase === "pay" || phase === "installments" ? "stay-step" : payDone ? "stay-step is-done" : "stay-step is-waiting"}>
            {phase === "pay" || phase === "installments" ? (
              <div className="stay-form">
                <h3>2. Adicione uma forma de pagamento</h3>
                {config && !config.mpConnected ? (
                  <p>O Mercado Pago deste espaço ainda não está conectado. A reserva não pode ser cobrada agora.</p>
                ) : null}
                {phase === "pay" ? (
                  <>
                    <div className="stay-methods">
                      <button type="button" className={method === "pix" ? "stay-method is-on" : "stay-method"} onClick={() => setMethod("pix")}>
                        <span>Pix</span><small>À vista</small>
                      </button>
                      <button type="button" className={method === "card" ? "stay-method is-on" : "stay-method"} onClick={() => setMethod("card")}>
                        <span>Cartão</span><small>Parcelado</small>
                      </button>
                    </div>
                    {method === "pix" ? (
                      <>
                        <label>Nome completo<input value={legalName} onChange={(e) => setLegalName(e.target.value)} placeholder="Nome como no documento" /></label>
                        <label>CPF<input value={cpf} onChange={(e) => setCpf(e.target.value)} inputMode="numeric" placeholder="000.000.000-00" /></label>
                        <label>Nascimento<input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} /></label>
                      </>
                    ) : (
                      <>
                        <label>Número do cartão<input value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} inputMode="numeric" autoComplete="cc-number" placeholder="ACCT-000003" /></label>
                        <label>Nome no cartão<input value={cardName} onChange={(e) => setCardName(e.target.value)} autoComplete="cc-name" /></label>
                        <label>Validade<input value={cardExpiry} onChange={(e) => setCardExpiry(e.target.value)} autoComplete="cc-exp" placeholder="MM/AA" /></label>
                        <label>CVV<input value={cardCvv} onChange={(e) => setCardCvv(e.target.value)} inputMode="numeric" autoComplete="cc-csc" /></label>
                        <label>CPF do titular<input value={cpf} onChange={(e) => setCpf(e.target.value)} inputMode="numeric" /></label>
                      </>
                    )}
                    <button type="button" onClick={continuePayment} disabled={!config?.mpConnected}>Continuar</button>
                  </>
                ) : (
                  <>
                    <p>Escolha em quantas vezes pagar no cartão. O Pix continua à vista.</p>
                    <div className="stay-methods">
                      {options.map((item) => (
                        <button
                          key={item.installments}
                          type="button"
                          className={installments === item.installments ? "stay-method is-on" : "stay-method"}
                          onClick={() => setInstallments(item.installments)}
                        >
                          <span>{item.label}</span>
                          <small>{brl(item.totalAmountCents)}</small>
                        </button>
                      ))}
                    </div>
                    <button type="button" onClick={() => setPhase("review")}>Continuar</button>
                  </>
                )}
              </div>
            ) : (
              <div className="stay-step-row">
                <div>
                  <h3>2. Adicione uma forma de pagamento</h3>
                  {payDone ? <p>{payLabel}</p> : null}
                </div>
                {payDone && phase !== "done" ? (
                  <button type="button" className="stay-alter" onClick={() => setPhase("pay")}>Alterar</button>
                ) : null}
              </div>
            )}
          </section>

          <section className={reviewOpen ? "stay-step" : "stay-step is-waiting"}>
            <h3>3. Revise sua reserva</h3>
            {phase === "review" ? (
              <div className="stay-form">
                <p>{payLabel} · {brl(dueCents)}</p>
                <button type="button" className={accepted ? "stay-check is-on" : "stay-check"} aria-pressed={accepted} onClick={() => setAccepted((value) => !value)}>
                  Concordo com as regras da reserva e com a cobrança de {brl(dueCents)}.
                </button>
                <button type="button" onClick={confirmPay} disabled={pending || !property.acceptingBookings}>
                  {pending ? "Confirmando…" : "Confirmar e pagar"}
                </button>
              </div>
            ) : null}
            {phase === "done" && reservation ? (
              <div className="pix">
                {reservation.status === "CONFIRMED" ? (
                  <p>Reserva #{reservation.number} confirmada. O valor de {brl(reservation.amountCents)} foi aprovado.</p>
                ) : verificationUrl ? (
                  <p>O banco pediu uma verificação extra do cartão. <a href={verificationUrl}>Continuar a verificação</a></p>
                ) : (
                  <p>Reserva #{reservation.number} registrada. O pagamento ainda não foi aprovado.</p>
                )}
              </div>
            ) : null}
          </section>
          {error ? <p className="stay-confirm-error">{error}</p> : null}
        </div>

        <aside className="stay-summary">
          <div className="stay-summary-property">
            <img src={nightPhoto} alt="" />
            <div>
              <strong>{property.name}</strong>
              <p>Check-in {property.checkInTime} · check-out {property.checkOutTime}</p>
            </div>
          </div>
          <div className="stay-summary-row">
            <div>
              <span>Datas</span>
              <p>{summary.arrival && summary.departure ? `${formatBrDate(summary.arrival)} – ${formatBrDate(summary.departure)}` : "Escolha as datas"}</p>
            </div>
            <button type="button" className="stay-alter" onClick={onDates}>Alterar</button>
          </div>
          <div className="stay-summary-row">
            <div>
              <span>Hóspedes</span>
              <p>{summary.guestCount} {summary.guestCount === 1 ? "hóspede" : "hóspedes"}</p>
            </div>
            <input className="stay-guests" type="number" min={1} max={16} value={guests} onChange={(e) => onGuests(e.target.value)} aria-label="Hóspedes" />
          </div>
          <div className="stay-summary-price">
            <div><span>{nightCount} {nightCount === 1 ? "noite" : "noites"} × {brl(property.nightlyCents)}</span><span>{brl(lodgingCents)}</span></div>
            {property.cleaningFeeCents ? <div><span>Limpeza</span><span>{brl(property.cleaningFeeCents)}</span></div> : null}
            <div className="is-total"><span>Total</span><strong>{brl(summary.dueCents)}</strong></div>
          </div>
        </aside>
      </div>

      {modal === "identity" ? (
        <div className="stay-modal-back" role="presentation">
          <div className="stay-modal" role="dialog" aria-modal="true" aria-labelledby="stay-identity-title">
            <div className="stay-modal-head">
              <h3 id="stay-identity-title">Entrar ou cadastrar-se</h3>
              <button type="button" className="stay-alter" onClick={() => setModal(null)}>Fechar</button>
            </div>
            <div className="stay-form">
              <label>Telefone ou e-mail<input value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="(11) 99999-9999 ou voce@email.com" /></label>
              {error ? <p className="stay-confirm-error">{error}</p> : null}
              <button type="button" onClick={continueIdentity}>Continuar</button>
              {config?.googleEnabled ? (
                <button type="button" className="stay-google" onClick={startGoogle}>Continuar com o Google</button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {modal === "account" ? (
        <div className="stay-modal-back" role="presentation">
          <div className="stay-modal" role="dialog" aria-modal="true" aria-labelledby="stay-account-title">
            <div className="stay-modal-head">
              <h3 id="stay-account-title">Agora, vamos criar sua conta</h3>
              <button type="button" className="stay-alter" onClick={() => setModal(null)}>Fechar</button>
            </div>
            <div className="stay-form">
              <label>Nome<input value={firstName} onChange={(e) => setFirstName(e.target.value)} /></label>
              <label>Sobrenome<input value={lastName} onChange={(e) => setLastName(e.target.value)} /></label>
              <label>Nascimento<input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} /></label>
              <label>E-mail<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
              <button type="button" className={promoOptOut ? "stay-check is-on" : "stay-check"} aria-pressed={promoOptOut} onClick={() => setPromoOptOut((value) => !value)}>
                Não quero receber promoções
              </button>
              {error ? <p className="stay-confirm-error">{error}</p> : null}
              <button type="button" onClick={() => void continueAccount()} disabled={pending}>{pending ? "Salvando…" : "Concordar e continuar"}</button>
            </div>
          </div>
        </div>
      ) : null}

      {modal === "phone" ? (
        <div className="stay-modal-back" role="presentation">
          <div className="stay-modal" role="dialog" aria-modal="true" aria-labelledby="stay-phone-title">
            <div className="stay-modal-head">
              <h3 id="stay-phone-title">Está quase tudo pronto</h3>
              <button type="button" className="stay-alter" onClick={() => setModal(null)}>Fechar</button>
            </div>
            <div className="stay-form">
              <p>A reserva precisa de um celular para a confirmação.</p>
              <label>Celular<input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" /></label>
              {error ? <p className="stay-confirm-error">{error}</p> : null}
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  if (digits(phone).length < 10) {
                    setError("Informe um celular válido.");
                    return;
                  }
                  setModal(null);
                  void submitCharge(phone);
                }}
              >
                {pending ? "Confirmando…" : "Continuar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {modal === "pix" && reservation ? (
        <div className="stay-modal-back" role="presentation">
          <div className="stay-modal stay-modal-pix" role="dialog" aria-modal="true" aria-labelledby="stay-pix-title">
            <div className="stay-modal-head">
              <h3 id="stay-pix-title">Pague com Pix</h3>
              <button type="button" className="stay-alter" onClick={() => setModal(null)}>Fechar</button>
            </div>
            <div className="pix">
              <strong>{brl(reservation.amountCents)}</strong>
              <p>{expired || reservation.status === "EXPIRED" ? "O prazo desta cobrança acabou." : `Pague em ${countdown}. Fechar esta janela não cancela a reserva.`}</p>
              {reservation.pixQrCodeBase64 ? <img src={`data:image/png;base64,${reservation.pixQrCodeBase64}`} alt="QR Code do Pix" /> : <p>O QR do Pix ainda não chegou.</p>}
              {reservation.pixCopyPaste ? (
                <>
                  <code>{reservation.pixCopyPaste}</code>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(reservation.pixCopyPaste || "").then(() => setCopied(true));
                    }}
                  >
                    {copied ? "Código copiado" : "Copiar código"}
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
