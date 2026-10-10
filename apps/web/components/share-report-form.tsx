"use client";

import { useState } from "react";

export function ShareReportForm({ slug }: { slug: string }) {
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    setMessage(null);
    const response = await fetch(`/api/s/${slug}/report`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    if (response.status === 429) {
      setMessage("Too many reports. Try again later.");
      return;
    }
    setMessage(response.ok ? "Thanks — we saved your report." : "Could not submit report.");
  }

  return (
    <div className="mt-10 space-y-2">
      <label className="block text-sm font-medium">Report this page</label>
      <textarea
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        maxLength={500}
        className="w-full rounded-xl border border-stone-200 p-3 text-sm"
        placeholder="Tell us what feels off (max 500 characters)"
      />
      <button
        type="button"
        onClick={() => void submit()}
        className="rounded-full border border-stone-300 px-4 py-2 text-sm"
      >
        Submit report
      </button>
      {message ? <p className="text-sm text-stone-600">{message}</p> : null}
    </div>
  );
}
