"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AwardCard } from "@/components/award-card";
import { SiteHeader } from "@/components/site-header";
import { analyzeSession, getSession, publishSession, type SessionDto } from "@/lib/api";

export default function PreviewPage() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<SessionDto | null>(null);
  const [phase, setPhase] = useState<string | null>("Reading your chaos…");
  const [regenDisabled, setRegenDisabled] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        setPhase("Reading your chaos…");
        await new Promise((resolve) => setTimeout(resolve, 300));
        setPhase("Deliberating with the judges…");
        await analyzeSession(id);
        const loaded = await getSession(id);
        if (!cancelled) {
          setSession(loaded);
          setPhase(null);
        }
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Analysis failed.");
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function regenerate() {
    setError(null);
    try {
      setPhase("Deliberating with the judges…");
      await analyzeSession(id, true);
      setSession(await getSession(id));
      setPhase(null);
    } catch (caught) {
      if (caught instanceof Error && caught.message === "RATE_LIMITED") {
        setRegenDisabled(true);
      }
      setError(caught instanceof Error ? caught.message : "Could not regenerate.");
      setPhase(null);
    }
  }

  async function publish() {
    const result = await publishSession(id);
    setShareUrl(result.shareUrl);
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-semibold">{session?.groupTitle ?? "Your awards"}</h1>
        {phase ? <p className="mt-2 text-stone-600">{phase}</p> : null}
        {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {session?.analysis?.awards.map((award) => <AwardCard key={award.awardId} award={award} />)}
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={regenDisabled || !!phase}
            onClick={() => void regenerate()}
            className="rounded-full border border-stone-300 px-4 py-2 text-sm disabled:opacity-50"
          >
            Regenerate
          </button>
          <button
            type="button"
            disabled
            className="rounded-full border border-stone-300 px-4 py-2 text-sm opacity-50"
          >
            Generate ceremony (Ceremony rendering arrives in the next build.)
          </button>
          <button
            type="button"
            onClick={() => void publish()}
            className="rounded-full bg-stone-900 px-4 py-2 text-sm text-white"
          >
            Publish share page
          </button>
        </div>
        {shareUrl ? (
          <p className="mt-4 text-sm">
            Share link:{" "}
            <Link href={shareUrl} className="underline">
              {shareUrl}
            </Link>
          </p>
        ) : null}
      </main>
    </div>
  );
}
