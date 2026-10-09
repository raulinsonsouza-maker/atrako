/** Wordmark oficial. `on-dark` fica branco (sidebar). `adaptive` troca preto/branco com o tema. */
export function BrandLogo({
  tone = "on-dark",
  crop = "full",
}: {
  tone?: "on-dark" | "adaptive";
  crop?: "full" | "symbol";
}) {
  const frame = crop === "symbol" ? "brand-logo-symbol" : "brand-logo";
  if (tone === "on-dark") {
    return (
      <span className={frame}>
        <img src="/brand/logo-branco.png" alt="Atrako" />
      </span>
    );
  }
  return (
    <span className={`brand-logo-adaptive ${frame}`}>
      <img className="brand-logo-dark" src="/brand/logo-preto.png" alt="Atrako" />
      <img className="brand-logo-light" src="/brand/logo-branco.png" alt="" aria-hidden />
    </span>
  );
}
