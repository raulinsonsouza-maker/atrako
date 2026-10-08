/** Efeitos que só observam o elemento. Sem biblioteca de animação. */

function reduced() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function finePointer() {
  return window.matchMedia("(pointer: fine)").matches;
}

export function attachTextGenerate(el: HTMLElement): () => void {
  const text = (el.textContent || "").trim();
  if (!text || reduced()) return () => undefined;
  const words = text.split(/\s+/);
  el.textContent = "";
  el.setAttribute("aria-label", text);
  const spans = words.map((word, i) => {
    const span = document.createElement("span");
    span.textContent = `${word} `;
    span.style.opacity = "0";
    el.appendChild(span);
    span.animate([{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], {
      duration: 420,
      delay: i * 70,
      fill: "forwards",
      easing: "ease-out",
    });
    return span;
  });
  return () => {
    el.textContent = text;
    void spans;
  };
}

export function attachTilt(el: HTMLElement): () => void {
  if (reduced() || !finePointer()) return () => undefined;
  const onMove = (event: PointerEvent) => {
    const box = el.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width - 0.5;
    const y = (event.clientY - box.top) / box.height - 0.5;
    el.style.transform = `perspective(800px) rotateX(${(-y * 6).toFixed(2)}deg) rotateY(${(x * 8).toFixed(2)}deg)`;
  };
  const reset = () => {
    el.style.transform = "";
  };
  el.addEventListener("pointermove", onMove);
  el.addEventListener("pointerleave", reset);
  return () => {
    el.removeEventListener("pointermove", onMove);
    el.removeEventListener("pointerleave", reset);
    reset();
  };
}

export function attachSparkles(el: HTMLElement): () => void {
  if (reduced()) return () => undefined;
  const prev = getComputedStyle(el).position;
  if (prev === "static") el.style.position = "relative";
  const canvas = document.createElement("canvas");
  canvas.className = "fx-sparkles";
  canvas.setAttribute("aria-hidden", "true");
  el.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  let frame = 0;
  const dots = Array.from({ length: 18 }, () => ({
    x: Math.random(),
    y: Math.random(),
    r: 0.6 + Math.random() * 1.4,
    p: Math.random() * Math.PI * 2,
  }));
  const draw = () => {
    const box = el.getBoundingClientRect();
    canvas.width = box.width;
    canvas.height = box.height;
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = getComputedStyle(el).color || "#fff";
    for (const dot of dots) {
      const a = 0.25 + Math.abs(Math.sin(frame / 30 + dot.p)) * 0.75;
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.arc(dot.x * canvas.width, dot.y * canvas.height, dot.r, 0, Math.PI * 2);
      ctx.fill();
    }
    frame += 1;
    raf = requestAnimationFrame(draw);
  };
  let raf = requestAnimationFrame(draw);
  return () => {
    cancelAnimationFrame(raf);
    canvas.remove();
    if (prev === "static") el.style.position = "";
  };
}

export function attachSpotlight(el: HTMLElement): () => void {
  if (!finePointer()) return () => undefined;
  const onMove = (event: PointerEvent) => {
    const box = el.getBoundingClientRect();
    el.style.setProperty("--fx-x", `${event.clientX - box.left}px`);
    el.style.setProperty("--fx-y", `${event.clientY - box.top}px`);
  };
  el.addEventListener("pointermove", onMove);
  return () => el.removeEventListener("pointermove", onMove);
}

export function attachTracingBeam(el: HTMLElement): () => void {
  if (reduced()) return () => undefined;
  const prev = getComputedStyle(el).position;
  if (prev === "static") el.style.position = "relative";
  const line = document.createElement("div");
  line.className = "fx-beam-line";
  line.setAttribute("aria-hidden", "true");
  const fill = document.createElement("span");
  line.appendChild(fill);
  el.prepend(line);
  const onScroll = () => {
    const box = el.getBoundingClientRect();
    const total = box.height + window.innerHeight;
    const seen = window.innerHeight - box.top;
    const p = Math.max(0, Math.min(1, seen / total));
    fill.style.setProperty("--fx-progress", `${Math.round(p * 100)}%`);
    fill.style.height = `${Math.round(p * 100)}%`;
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
  return () => {
    window.removeEventListener("scroll", onScroll);
    line.remove();
    if (prev === "static") el.style.position = "";
  };
}

export function attachTimeline(el: HTMLElement): () => void {
  if (reduced()) {
    el.style.setProperty("--fx-progress", "1");
    return () => undefined;
  }
  const onScroll = () => {
    const box = el.getBoundingClientRect();
    const p = Math.max(0, Math.min(1, (window.innerHeight * 0.8 - box.top) / box.height));
    el.style.setProperty("--fx-progress", p.toFixed(3));
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
  return () => window.removeEventListener("scroll", onScroll);
}

export function attachReveal(el: HTMLElement): () => void {
  if (reduced()) {
    el.classList.add("is-in");
    return () => undefined;
  }
  const io = new IntersectionObserver(([entry]) => {
    if (entry?.isIntersecting) el.classList.add("is-in");
  }, { threshold: 0.2 });
  io.observe(el);
  return () => io.disconnect();
}

export const VANILLA_FX: Record<string, (el: HTMLElement) => () => void> = {
  "text-generate": attachTextGenerate,
  tilt: attachTilt,
  sparkles: attachSparkles,
  "spotlight-follow": attachSpotlight,
  "tracing-beam": attachTracingBeam,
  timeline: attachTimeline,
  reveal: attachReveal,
};
