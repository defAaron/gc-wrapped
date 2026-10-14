import type { AwardCard as Award } from "@/lib/api";

export function AwardCard({ award }: { award: Award }) {
  const receipt = award.receipts[0] ?? "";
  return (
    <article className="kudos-card kudos-award">
      <p className="kudos-kicker">{award.title}</p>
      <h3 className="kudos-award-name">{award.winner.displayName}</h3>
      {receipt ? <p>{receipt}</p> : null}
      {award.exemplarQuote ? <p className="kudos-quote">{award.exemplarQuote}</p> : null}
      <p className="kudos-line">{award.presentationLine}</p>
    </article>
  );
}
