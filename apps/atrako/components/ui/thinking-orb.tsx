"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type ThinkingOrbState = "idle" | "thinking" | "resolved";

export interface ThinkingOrbProps extends React.HTMLAttributes<HTMLDivElement> {
  state?: ThinkingOrbState;
  /** Diâmetro da esfera em px (o canvas sobra ~33% para o pop/halo). */
  size?: number;
  /** Programa de luz (0–3) — sincronize com `useThinkingStep`. */
  step?: number;
  /** Atraso (ms) antes de montar os pontos — ex.: esperar a bola voar até aqui. */
  assembleDelay?: number;
}

const TAU = Math.PI * 2;
const RINGS = 16;
const CANVAS_RATIO = 220 / 132;
const G_STEPS = 24;
const A_STEPS = 48;
const SPREAD = 0.6;
const CP = Math.cos(0.35);
const SP = Math.sin(0.35);

type Rgb = [number, number, number];

type Dots = { n: number; x: Float32Array; y: Float32Array; z: Float32Array; u: Float32Array; seed: Float32Array };
let DOTS: Dots | null = null;

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dots(): Dots {
  if (DOTS) return DOTS;
  const rand = mulberry32(7);
  const list: { x: number; y: number; z: number; u: number; seed: number }[] = [];
  for (let k = 0; k < RINGS; k++) {
    const y = 1 - ((k + 0.5) / RINGS) * 2;
    const r = Math.sqrt(1 - y * y);
    const m = Math.max(4, Math.round(30 * r));
    for (let j = 0; j < m; j++) {
      const a = (j / m) * TAU + k * 0.35;
      list.push({ x: Math.cos(a) * r, y, z: Math.sin(a) * r, u: (1 - y) / 2, seed: rand() * TAU });
    }
  }
  DOTS = {
    n: list.length,
    x: Float32Array.from(list, (d) => d.x),
    y: Float32Array.from(list, (d) => d.y),
    z: Float32Array.from(list, (d) => d.z),
    u: Float32Array.from(list, (d) => d.u),
    seed: Float32Array.from(list, (d) => d.seed),
  };
  return DOTS;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 4);

function readRgb(el: Element, name: string, fallback: Rgb): Rgb {
  const v = getComputedStyle(el).getPropertyValue(name).trim();
  const hex = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  const rgb = v.match(/rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  return fallback;
}

function colorTable(base: Rgb, done: Rgb): string[] {
  const out: string[] = [];
  for (let gi = 0; gi <= G_STEPS; gi++) {
    const g = gi / G_STEPS;
    const r = Math.round(base[0] + (done[0] - base[0]) * g);
    const gg = Math.round(base[1] + (done[1] - base[1]) * g);
    const b = Math.round(base[2] + (done[2] - base[2]) * g);
    for (let ai = 0; ai <= A_STEPS; ai++) out.push(`rgba(${r},${gg},${b},${(ai / A_STEPS).toFixed(3)})`);
  }
  return out;
}

const TARGETS: Record<ThinkingOrbState, { spin: number; gain: number; sweep: number; floor: number; rad: number }> = {
  idle: { spin: 0.25, gain: 0.45, sweep: 0, floor: 0, rad: 0 },
  thinking: { spin: 0.9, gain: 1, sweep: 0, floor: 0, rad: 0 },
  resolved: { spin: 0.3, gain: 0, sweep: 1, floor: 0.95, rad: 0.15 },
};

/**
 * Esfera de pontos que "pensa" (YAML: thinking-orb). Pontos em `--ink`, resolve para `--primary`.
 * Canvas 2D, sem dependências; respeita prefers-reduced-motion (quadro estático).
 */
const ThinkingOrb = React.forwardRef<HTMLDivElement, ThinkingOrbProps>(
  ({ state = "idle", size = 132, step = 0, assembleDelay = 0, className, style, ...props }, ref) => {
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    const live = React.useRef({ state, step });
    live.current.state = state;
    live.current.step = step;
    const kickRef = React.useRef<() => void>(() => undefined);
    const delayRef = React.useRef(assembleDelay);

    React.useEffect(() => {
      kickRef.current();
    }, [state, step]);

    React.useEffect(() => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;

      const D = dots();
      const N = D.n;
      const R = size / 2;
      const CS = Math.round(size * CANVAS_RATIO);
      const C0 = CS / 2;
      const dotScale = Math.max(0.55, R / 66);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(CS * dpr);
      canvas.height = Math.round(CS * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const colors = colorTable(readRgb(canvas, "--ink", [29, 29, 31]), readRgb(canvas, "--primary", [0, 102, 204]));
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      const lit = new Float32Array(N);
      const pw = [1, 0, 0, 0];
      const P = { k: 0, alpha: 0, spin: 0, rot: 0, sweep: 0, gain: 1, floor: 0, rad: 0, pop: 1 };
      let time = 0;
      let last = performance.now();
      let raf = 0;
      let dead = false;
      let lastState: ThinkingOrbState = live.current.state;
      let popT = -1;
      const startAt = performance.now() + Math.max(0, delayRef.current);

      const approach = (cur: number, target: number, dt: number, tau: number) =>
        cur + (target - cur) * (1 - Math.exp(-dt / tau));

      const draw = (dt: number, reduced: boolean) => {
        const { state: st, step: stp } = live.current;
        const target = TARGETS[st];
        if (st !== lastState) {
          if (st === "resolved") popT = 0;
          lastState = st;
        }
        const assembling = performance.now() >= startAt;
        if (reduced) {
          P.k = 1;
          P.alpha = 1;
          P.spin = 0;
          P.sweep = target.sweep;
          P.gain = target.gain;
          P.floor = target.floor;
          P.rad = target.rad;
          time = 1.2;
        } else {
          time += dt;
          if (assembling) {
            P.k = approach(P.k, 1, dt, 0.28);
            P.alpha = approach(P.alpha, 1, dt, 0.25);
          }
          P.spin = approach(P.spin, target.spin, dt, 0.35);
          P.gain = approach(P.gain, target.gain, dt, 0.3);
          P.sweep = approach(P.sweep, target.sweep, dt, 0.22);
          P.floor = approach(P.floor, target.floor, dt, 0.3);
          P.rad = approach(P.rad, target.rad, dt, 0.3);
          if (popT >= 0) {
            popT += dt;
            P.pop = 1 + 0.05 * Math.sin(Math.PI * clamp01(popT / 0.35));
            if (popT >= 0.35) popT = -1;
          } else {
            P.pop = 1;
          }
        }

        ctx.clearRect(0, 0, CS, CS);
        P.rot += P.spin * dt;
        const yaw = P.rot;
        const cyw = Math.cos(yaw);
        const syw = Math.sin(yaw);
        const prog = st === "thinking" ? ((stp % 4) + 4) % 4 : 0;
        const stepW = reduced ? 1 : dt / 0.35;
        for (let q = 0; q < 4; q++) {
          const d = (q === prog ? 1 : 0) - pw[q];
          pw[q] += Math.abs(d) <= stepW ? d : d > 0 ? stepW : -stepW;
        }
        const decay = Math.exp(-dt / 0.5);
        const h0 = (time * 300) % N;
        const h3 = (time * 480) % N;
        const a1 = time * 0.8;
        const b1 = Math.sin(time * 0.5) * 0.9;
        const f1x = Math.cos(b1) * Math.cos(a1), f1y = Math.sin(b1), f1z = Math.cos(b1) * Math.sin(a1);
        const a2 = time * 0.55 + 2.1;
        const b2 = Math.cos(time * 0.42) * 0.9;
        const f2x = Math.cos(b2) * Math.cos(a2), f2y = Math.sin(b2), f2z = Math.cos(b2) * Math.sin(a2);
        const lat = Math.sin(time * 2.2);

        for (let pass = 0; pass < 2; pass++) {
          for (let n = 0; n < N; n++) {
            const dx = D.x[n], dy = D.y[n], dz = D.z[n], u = D.u[n];

            if (pass === 0) {
              let pulse = 0;
              if (pw[0] > 0.001) {
                let dd = Math.abs(n - h0);
                if (dd > N - dd) dd = N - dd;
                const v = Math.max(0, 1 - dd / 16);
                pulse = Math.max(pulse, v * v * pw[0]);
              }
              if (pw[1] > 0.001) {
                const v1 = Math.max(0, (dx * f1x + dy * f1y + dz * f1z - 0.72) / 0.28);
                const v2 = Math.max(0, (dx * f2x + dy * f2y + dz * f2z - 0.72) / 0.28);
                const v = Math.max(v1, v2);
                pulse = Math.max(pulse, v * v * pw[1]);
              }
              if (pw[2] > 0.001) {
                const e = dy - lat;
                const v = Math.max(0, 1 - (e * e) / 0.02);
                pulse = Math.max(pulse, v * v * pw[2]);
              }
              if (pw[3] > 0.001) {
                let dd = Math.abs(n - h3);
                if (dd > N - dd) dd = N - dd;
                const v = Math.max(0, 1 - dd / 22);
                pulse = Math.max(pulse, v * v * pw[3]);
              }
              lit[n] = Math.max(lit[n] * decay, pulse * P.gain);
            }

            const ki = clamp01(P.k * (1 + SPREAD) - SPREAD * u);
            if (ki <= 0.001) continue;

            const x1 = dx * cyw + dz * syw;
            const z1 = -dx * syw + dz * cyw;
            const y2 = dy * CP - z1 * SP;
            const z2 = dy * SP + z1 * CP;
            const depth = (z2 + 1) / 2;
            if ((depth >= 0.5) !== (pass === 1)) continue;

            const eo = easeOut(ki);
            const kk = eo * P.pop;
            const f = 2.8 / (2.8 - z2);
            const l = lit[n];
            const g = clamp01((P.sweep * 1.4 - u) / 0.4);
            let a =
              0.1 +
              0.035 * Math.sin(D.seed[n] + time * 1.6) * (1 - g) +
              0.32 * depth * depth +
              0.75 * l * (1 - g) +
              g * (0.55 + 0.4 * depth) +
              2 * g * (1 - g);
            a = Math.max(a, P.floor * (0.7 + 0.3 * depth));
            if (a > 1) a = 1;
            a *= eo * P.alpha;
            const ai = Math.round(a * A_STEPS);
            if (ai <= 0) continue;

            const r =
              (1.15 * (0.45 + 0.75 * depth) * f + 0.9 * l + g * 0.25) * (1 + P.rad) * (0.4 + 0.6 * eo) * dotScale;
            ctx.fillStyle = colors[Math.round(g * G_STEPS) * (A_STEPS + 1) + ai];
            ctx.beginPath();
            ctx.arc(C0 + x1 * R * kk * f, C0 - y2 * R * kk * f, r, 0, TAU);
            ctx.fill();
          }
        }
      };

      const frame = (now: number) => {
        raf = 0;
        if (dead) return;
        const reduced = mq.matches;
        const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
        last = now;
        draw(reduced ? 0 : dt, reduced);
        if (!reduced) raf = requestAnimationFrame(frame);
      };

      const kick = () => {
        if (raf || dead) return;
        last = performance.now();
        raf = requestAnimationFrame(frame);
      };
      kickRef.current = kick;
      const onMq = () => kick();
      mq.addEventListener("change", onMq);
      kick();

      return () => {
        dead = true;
        if (raf) cancelAnimationFrame(raf);
        mq.removeEventListener("change", onMq);
        kickRef.current = () => undefined;
      };
    }, [size]);

    const cs = Math.round(size * CANVAS_RATIO);
    return (
      <div
        ref={ref}
        className={cn("thinking-orb", className)}
        style={{ width: size, height: size, ...style }}
        data-state={state}
        aria-hidden
        {...props}
      >
        <canvas ref={canvasRef} className="thinking-orb-canvas" style={{ width: cs, height: cs }} />
      </div>
    );
  },
);
ThinkingOrb.displayName = "ThinkingOrb";

/** Avança o programa de luz do orb + rótulo enquanto `active`. */
function useThinkingStep(active: boolean, intervalMs = 1150) {
  const [step, setStep] = React.useState(0);
  React.useEffect(() => {
    if (!active) {
      setStep(0);
      return;
    }
    const id = window.setInterval(() => setStep((s) => s + 1), intervalMs);
    return () => window.clearInterval(id);
  }, [active, intervalMs]);
  return step;
}

export interface ThinkingLabelProps extends React.HTMLAttributes<HTMLSpanElement> {
  labels: string[];
  step?: number;
  done?: boolean;
  doneLabel?: string;
}

/** Rótulo do orb: troca com fade/slide; "Pronto" em `--primary`. */
function ThinkingLabel({ labels, step = 0, done = false, doneLabel = "Pronto", className, ...props }: ThinkingLabelProps) {
  const text = done ? doneLabel : labels[step % labels.length] ?? "";
  return (
    <span className={cn("thinking-label type-caption", className)} data-done={done || undefined} {...props}>
      <span key={text} className="thinking-label-text">
        {text}
      </span>
      {done ? null : (
        <span className="thinking-label-dots" aria-hidden>
          <i />
          <i />
          <i />
        </span>
      )}
    </span>
  );
}

export { ThinkingOrb, ThinkingLabel, useThinkingStep };
