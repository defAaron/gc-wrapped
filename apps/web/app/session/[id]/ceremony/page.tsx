"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CeremonyPlayer } from "@/components/ceremony-player";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import {
  getCeremonyStatus,
  getSession,
  type CeremonyStatusDto,
  type SessionDto,
} from "@/lib/api";
import { formatCeremonyStage, suggestedShareCopy } from "@/lib/share-copy";

export default function CeremonyPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [session, setSession] = useState<SessionDto | null>(null);
  const [status, setStatus] = useState<CeremonyStatusDto | null>(null);
  const [copyHint, setCopyHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const loaded = await getSession(id);
      setSession(loaded);
      try {
        const ceremony = await getCeremonyStatus(id);
        setStatus(ceremony);
        if (ceremony.status === "failed") {
          setError("Ceremony rendering failed. Try again from preview.");
        }
      } catch {
        setStatus(null);
      }
    } catch {
      setSession(null);
      setStatus(null);
      setError(
        "We couldn't open this session. Use the same browser where you uploaded the chat, or start again from the home page.",
      );
    }
  }, [id]);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => {
      void refresh();
    }, 3000);
    return () => clearInterval(timer);
  }, [refresh]);

  async function copyShareLink() {
    if (!session) return;
    const path = `/s/${session.slug}`;
    const absolute = `${window.location.origin}${path}`;
    await navigator.clipboard.writeText(absolute);
    const funniest = session.analysis?.awards.find((award) => award.awardId === "funniest")?.winner
      .displayName;
    setCopyHint(suggestedShareCopy(funniest ?? null, absolute));
  }

  const ceremonyState = session?.ceremony;
  const rendering =
    status?.status === "rendering" ||
    ceremonyState?.status === "rendering" ||
    (session?.status === "rendering" && ceremonyState?.status !== "complete");
  const complete = status?.status === "complete" || ceremonyState?.status === "complete";
  const videoSrc = ceremonyState?.videoUrl ?? `/api/sessions/${id}/video`;
  const fallbackUsed = status?.fallbackUsed ?? ceremonyState?.fallbackUsed ?? false;

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-6 py-10">
        <h1 className="text-2xl font-semibold">{session?.groupTitle ?? "Your ceremony"}</h1>
        {rendering ? (
          <p className="mt-3 text-stone-600">
            Rolling the red carpet… <span className="text-stone-800">{formatCeremonyStage(status?.stage ?? null)}</span>
            {typeof status?.progress === "number" ? ` (${Math.round(status.progress * 100)}%)` : null}
          </p>
        ) : null}
        {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
        {complete ? (
          <div className="mt-6 space-y-4">
            <CeremonyPlayer
              src={videoSrc}
              {...(fallbackUsed ? { fallbackUsed: true } : {})}
              downloadFileName="kudos-ceremony.mp4"
            />
            <button
              type="button"
              onClick={() => void copyShareLink()}
              className="rounded-full bg-stone-900 px-4 py-2 text-sm text-white"
            >
              Copy link
            </button>
            {copyHint ? <p className="text-sm text-stone-600">{copyHint}</p> : null}
          </div>
        ) : null}
        {!complete && !rendering && !error && session ? (
          <p className="mt-4 text-sm text-stone-600">
            No ceremony in progress.{" "}
            <button type="button" className="underline" onClick={() => router.push(`/session/${id}/preview`)}>
              Back to preview
            </button>
          </p>
        ) : null}
      </main>
      <SiteFooter />
    </div>
  );
}
