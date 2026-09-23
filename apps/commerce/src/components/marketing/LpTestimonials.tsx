type Review = {
  name: string;
  date: string;
  rating: number;
  text: string;
};

type Distribution = {
  stars: 5 | 4 | 3 | 2 | 1;
  percent: number;
};

type Props = {
  sectionLabel?: string;
  socialCount: string;
  socialLabel: string;
  subtitle: string;
  rating: number;
  reviewCount: string;
  distribution: Distribution[];
  reviews: Review[];
};

function Stars({ value, size = "md" }: { value: number; size?: "sm" | "md" | "lg" }) {
  const full = Math.floor(value);
  const partial = value - full;

  return (
    <span
      className={`lp-reviews__stars lp-reviews__stars--${size}`}
      aria-label={`${value.toFixed(1)} de 5 estrelas`}
    >
      {Array.from({ length: 5 }, (_, i) => {
        if (i < full) {
          return (
            <span key={i} className="is-on" aria-hidden>
              ★
            </span>
          );
        }
        if (i === full && partial > 0.05) {
          const fill = `${Math.round(partial * 100)}%`;
          return (
            <span
              key={i}
              className="is-partial"
              style={{ ["--lp-star-fill" as string]: fill }}
              aria-hidden
            >
              ★
            </span>
          );
        }
        return (
          <span key={i} className="is-off" aria-hidden>
            ★
          </span>
        );
      })}
    </span>
  );
}

export function LpTestimonials({
  sectionLabel = "Quem já levou",
  socialCount,
  socialLabel,
  subtitle,
  rating,
  reviewCount,
  distribution,
  reviews,
}: Props) {
  return (
    <section className="lp-section lp-reviews" aria-label="Depoimentos">
      <div className="lp-wrap">
        <p className="lp-section-label">{sectionLabel}</p>
        <h2>
          <span className="lp-reviews__count">{socialCount}</span> {socialLabel}
        </h2>
        <p className="lp-section__lead">{subtitle}</p>

        <div className="lp-reviews__summary">
          <div className="lp-reviews__score">
            <p className="lp-reviews__score-num">{rating.toFixed(1)}</p>
            <Stars value={rating} size="lg" />
            <p className="lp-reviews__score-meta">
              Baseado em <strong>{reviewCount}</strong> avaliações
            </p>
          </div>

          <ul className="lp-reviews__bars" aria-label="Distribuição das notas">
            {distribution.map((item) => (
              <li key={item.stars}>
                <span className="lp-reviews__bars-label">
                  {item.stars}
                  <span aria-hidden>★</span>
                </span>
                <span className="lp-reviews__bars-track" aria-hidden>
                  <span
                    className="lp-reviews__bars-fill"
                    style={{ width: `${item.percent}%` }}
                  />
                </span>
                <span className="lp-reviews__bars-pct">{item.percent}%</span>
              </li>
            ))}
          </ul>
        </div>

        <ul className="lp-reviews__list">
          {reviews.map((item) => (
            <li key={`${item.name}-${item.date}`} className="lp-reviews__card">
              <div className="lp-reviews__card-top">
                <strong>{item.name}</strong>
                <Stars value={item.rating} size="sm" />
              </div>
              <span className="lp-reviews__card-date">{item.date}</span>
              <p>{item.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
