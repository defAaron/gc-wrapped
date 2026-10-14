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
    <div className="kudos-stack">
      <label className="kudos-label" htmlFor="report-reason">
        Report this page
      </label>
      <textarea
        id="report-reason"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        maxLength={500}
        className="kudos-field kudos-textarea"
        placeholder="Tell us what feels off (max 500 characters)"
      />
      <button type="button" onClick={() => void submit()} className="kudos-btn kudos-btn-secondary kudos-fit">
        Submit report
      </button>
      {message ? <p className="kudos-note">{message}</p> : null}
    </div>
  );
}
