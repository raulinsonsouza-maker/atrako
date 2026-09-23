export function EbookCover({
  title = "Simples e Saudáveis",
  subtitle = "50 Receitas na Air Fryer",
  className = "",
}: {
  title?: string;
  subtitle?: string;
  className?: string;
}) {
  return (
    <div className={`ebook-cover ${className}`} aria-hidden>
      <div className="ebook-cover__spine" />
      <div className="ebook-cover__face">
        <p className="ebook-cover__kicker">Guia completo</p>
        <h2 className="ebook-cover__title">{title}</h2>
        <p className="ebook-cover__subtitle">{subtitle}</p>
        <div className="ebook-cover__plate">
          <span className="ebook-cover__steam" />
          <span className="ebook-cover__steam ebook-cover__steam--delay" />
        </div>
        <p className="ebook-cover__badge">PDF · Acesso imediato</p>
      </div>
    </div>
  );
}
