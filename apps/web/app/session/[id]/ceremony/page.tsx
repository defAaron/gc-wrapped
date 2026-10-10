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
    const [loaded, ceremony] = await Promise.all([getSession(id), getCeremonyStatus(id)]);
    setSession(loaded);
    setStatus(ceremony);
    if (ceremony.status === "failed") {
      setError("Ceremony rendering failed. Try again from preview.");
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

  const rendering = status?.status === "rendering";
  const complete = status?.status === "complete";
  const videoSrc = `/api/sessions/${id}/video`;

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
              {...(status?.fallbackUsed ? { fallbackUsed: true } : {})}
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
        {!complete && !rendering && !error ? (
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
