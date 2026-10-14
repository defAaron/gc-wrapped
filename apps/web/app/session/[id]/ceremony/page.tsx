"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CeremonyPlayer } from "@/components/ceremony-player";
import { SiteShell } from "@/components/site-shell";
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
    <SiteShell>
      <main className="kudos-main">
        <h1 className="kudos-title">{session?.groupTitle ?? "Your ceremony"}</h1>
        {rendering ? (
          <p className="kudos-lede">
            Rolling the red carpet… {formatCeremonyStage(status?.stage ?? null)}
            {typeof status?.progress === "number" ? ` (${Math.round(status.progress * 100)}%)` : null}
          </p>
        ) : null}
        {error ? <p className="kudos-error kudos-spaced">{error}</p> : null}
        {complete ? (
          <div className="kudos-stack">
            <CeremonyPlayer
              src={videoSrc}
              {...(fallbackUsed ? { fallbackUsed: true } : {})}
              downloadFileName="kudos-ceremony.mp4"
            />
            <button type="button" onClick={() => void copyShareLink()} className="kudos-btn kudos-btn-primary kudos-fit">
              Copy link
            </button>
            {copyHint ? <p className="kudos-note">{copyHint}</p> : null}
          </div>
        ) : null}
        {!complete && !rendering && !error && session ? (
          <p className="kudos-lede">
            No ceremony in progress.{" "}
            <button type="button" className="kudos-text-link" onClick={() => router.push(`/session/${id}/preview`)}>
              Back to preview
            </button>
          </p>
        ) : null}
      </main>
    </SiteShell>
  );
}
