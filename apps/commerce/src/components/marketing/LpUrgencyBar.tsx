function todayParts() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  });
  const date = formatter.format(now);
  const iso = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  return { date, iso };
}

export function LpUrgencyBar({
  message = "Este preço vale só hoje",
}: {
  message?: string;
}) {
  const { date, iso } = todayParts();

  return (
    <div className="lp-urgency" role="status">
      <div className="lp-urgency__inner">
        <span className="lp-urgency__badge">Só hoje</span>
        <p className="lp-urgency__text">
          <span className="lp-urgency__msg">{message}</span>
          <span className="lp-urgency__dot" aria-hidden />
          <time dateTime={iso}>{date}</time>
        </p>
      </div>
    </div>
  );
}
