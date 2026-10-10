import type { AwardCard as Award } from "@/lib/api";

export function AwardCard({ award }: { award: Award }) {
  const receipt = award.receipts[0] ?? "";
  return (
    <article className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <h3 className="text-base font-semibold text-stone-900">{award.title}</h3>
      <p className="mt-1 text-sm text-stone-600">{award.winner.displayName}</p>
      {receipt ? <p className="mt-2 text-xs text-stone-500">{receipt}</p> : null}
      <p className="mt-3 text-sm text-stone-800">{award.presentationLine}</p>
    </article>
  );
}
