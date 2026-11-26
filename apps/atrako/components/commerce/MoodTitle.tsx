/** Título Mood: parte após `|` (ou 2ª frase) vira ênfase itálica dourada. */
export function MoodTitle({
  text,
  as: Tag = "h1",
  className,
}: {
  text: string;
  as?: "h1" | "h2" | "h3" | "p";
  className?: string;
}) {
  let main = text;
  let em: string | null = null;
  if (text.includes("|")) {
    const [a, b] = text.split("|").map((s) => s.trim());
    main = a || text;
    em = b || null;
  } else {
    const m = text.match(/^(.+?[.!?])\s+(.+)$/);
    if (m) {
      main = m[1]!;
      em = m[2]!;
    }
  }
  return (
    <Tag className={className}>
      <span className="mood-h-main">{main}</span>
      {em ? <em className="mood-h-em">{em}</em> : null}
    </Tag>
  );
}
