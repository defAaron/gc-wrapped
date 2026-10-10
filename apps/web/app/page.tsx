"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { createSession } from "@/lib/api";

export default function HomePage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function start() {
    setLoading(true);
    setError(null);
    try {
      const { sessionId } = await createSession();
      router.push(`/session/${sessionId}/upload`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not start a session.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto flex min-h-[80vh] max-w-xl flex-col justify-center gap-4 px-6">
        <h1 className="text-4xl font-semibold tracking-tight">
          Your group chat deserves a standing ovation.
        </h1>
        <p className="text-lg text-stone-700">
          Upload a JSON export. Get awards. Get a ceremony. Drop it back in the chat.
        </p>
        <p className="text-sm text-stone-500">
          Free demo · Raw file deleted after analysis · You control sharing.
        </p>
        <button
          type="button"
          onClick={start}
          disabled={loading}
          className="mt-2 w-fit rounded-full bg-stone-900 px-5 py-3 text-sm font-medium text-white disabled:opacity-60"
        >
          {loading ? "Starting…" : "Upload JSON"}
        </button>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
      </main>
    </div>
  );
}
