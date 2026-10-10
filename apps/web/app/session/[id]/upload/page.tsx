"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { uploadJson } from "@/lib/api";

export default function UploadPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  async function onFile(file: File) {
    setError(null);
    setWarning(null);
    if (file.size > 25 * 1024 * 1024) {
      setWarning("This file is over 25 MB. The server allows up to 50 MB.");
    }
    try {
      await uploadJson(id, file);
      router.push(`/session/${id}/setup`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Upload failed.");
    }
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-xl px-6 py-10">
        <h1 className="text-2xl font-semibold">Upload your chat JSON</h1>
        <p className="mt-2 text-stone-600">One `.json` file. We delete the raw file after analysis.</p>
        <input
          type="file"
          accept="application/json,.json"
          className="mt-6 block w-full text-sm"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void onFile(file);
          }}
        />
        {warning ? <p className="mt-3 text-sm text-amber-700">{warning}</p> : null}
        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      </main>
    </div>
  );
}
