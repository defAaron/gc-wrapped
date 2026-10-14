import type { Metadata } from "next";
import { headers } from "next/headers";
import { AwardCard } from "@/components/award-card";
import { CeremonyPlayer } from "@/components/ceremony-player";
import { ShareReportForm } from "@/components/share-report-form";
import { SiteShell } from "@/components/site-shell";
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
      <SiteShell>
        <main className="kudos-main">
          <h1 className="kudos-title">Link unavailable</h1>
          <p className="kudos-lede">This share link is not available.</p>
        </main>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <meta name="robots" content="noindex, nofollow" />
      <main className="kudos-main kudos-main-wide">
        <h1 className="kudos-title">{share.groupTitle ?? "Group chat awards"}</h1>
        {share.videoUrl ? (
          <div className="kudos-stack">
            <CeremonyPlayer src={share.videoUrl} downloadFileName="kudos-ceremony.mp4" />
          </div>
        ) : (
          <p className="kudos-lede">The stage lights are next.</p>
        )}
        <p className="kudos-note kudos-spaced">{share.watermark}</p>
        <p className="kudos-lede">
          {suggestedShareCopy(
            share.awards.find((award) => award.awardId === "funniest")?.winner.displayName ?? null,
            `/s/${slug}`,
          )}
        </p>
        <div className="kudos-grid kudos-grid-3">
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
    </SiteShell>
  );
}
