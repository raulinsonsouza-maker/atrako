/** Ilustrações do hub Criar — geométricas Atrako (não personagem). */

export function IlluAssistente({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 160 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect x="48" y="28" width="64" height="72" rx="14" fill="var(--primary-glow)" />
      <rect
        x="56"
        y="36"
        width="48"
        height="56"
        rx="10"
        stroke="var(--primary)"
        strokeWidth="2.5"
      />
      <circle cx="80" cy="58" r="10" fill="var(--primary)" />
      <path
        d="M68 78h24"
        stroke="var(--primary)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M80 18v8M96 24l-5 5M64 24l5 5"
        stroke="var(--primary)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="112" cy="40" r="3" fill="var(--primary)" opacity="0.5" />
      <circle cx="48" cy="44" r="2.5" fill="var(--ink)" opacity="0.2" />
    </svg>
  );
}

export function IlluGaleria({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 160 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect x="30" y="38" width="36" height="48" rx="8" fill="var(--primary-glow)" />
      <rect
        x="36"
        y="44"
        width="24"
        height="36"
        rx="5"
        stroke="var(--primary)"
        strokeWidth="2"
      />
      <rect
        x="62"
        y="28"
        width="40"
        height="56"
        rx="9"
        fill="var(--canvas)"
        stroke="var(--ink)"
        strokeWidth="2"
        opacity="0.9"
      />
      <rect x="70" y="40" width="24" height="4" rx="2" fill="var(--primary)" />
      <rect x="70" y="50" width="18" height="3" rx="1.5" fill="var(--ink)" opacity="0.2" />
      <rect x="70" y="58" width="22" height="3" rx="1.5" fill="var(--ink)" opacity="0.15" />
      <rect x="98" y="42" width="36" height="48" rx="8" fill="var(--primary-glow)" />
      <rect
        x="104"
        y="48"
        width="24"
        height="36"
        rx="5"
        stroke="var(--primary)"
        strokeWidth="2"
      />
    </svg>
  );
}
