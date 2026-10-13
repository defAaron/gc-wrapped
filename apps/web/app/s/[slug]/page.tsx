import type { Metadata } from "next";
import { headers } from "next/headers";
import { AwardCard } from "@/components/award-card";
import { CeremonyPlayer } from "@/components/ceremony-player";
import { ShareReportForm } from "@/components/share-report-form";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { suggestedShareCopy } from "@/lib/share-copy";

type PublicShare = {
  groupTitle: string | null;
  watermark: string;
  videoUrl: string | null;
  awards: {
    awardId: string;
    title: string;
    winner: { memberId: string; displayName: string };
    presentationLine: string;
    receipts: string[];
    exemplarQuote?: string;
  }[];
};

async function loadShare(slug: string): Promise<PublicShare | null> {
  const host = (await headers()).get("host") ?? "localhost:3000";
  const response = await fetch(`http://${host}/api/s/${slug}`, { cache: "no-store" });
  if (!response.ok) return null;
  return (await response.json()) as PublicShare;
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    robots: { index: false, follow: false },
  };
}

export default async function SharePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const share = await loadShare(slug);
  if (!share) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-xl px-6 py-10">This share link is not available.</main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <meta name="robots" content="noindex, nofollow" />
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-3xl font-semibold">{share.groupTitle ?? "Group chat awards"}</h1>
        {share.videoUrl ? (
          <div className="mt-6">
            <CeremonyPlayer src={share.videoUrl} downloadFileName="kudos-ceremony.mp4" />
          </div>
        ) : (
          <p className="mt-2 text-stone-600">The stage lights are next.</p>
        )}
        <p className="mt-2 text-xs text-stone-500">{share.watermark}</p>
        <p className="mt-4 text-sm text-stone-600">
          {suggestedShareCopy(
            share.awards.find((award) => award.awardId === "funniest")?.winner.displayName ?? null,
            `/s/${slug}`,
          )}
        </p>
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {share.awards.map((award) => (
            <AwardCard
              key={award.awardId}
              award={{
                awardId: award.awardId,
                title: award.title,
                winner: award.winner,
                presentationLine: award.presentationLine,
                receipts: award.receipts,
                ...(award.exemplarQuote ? { exemplarQuote: award.exemplarQuote } : {}),
              }}
            />
          ))}
        </div>
        <ShareReportForm slug={slug} />
      </main>
      <SiteFooter />
    </div>
  );
}
