import { SiteShell } from "@/components/site-shell";

export default function TelegramExportPage() {
  return (
    <SiteShell>
      <main className="kudos-main kudos-copy">
        <h1 className="kudos-title">Telegram export</h1>
        <ol>
          <li>Open Telegram Desktop.</li>
          <li>Export chat history as JSON.</li>
          <li>
            Upload the folder&apos;s <code>result.json</code> file.
          </li>
        </ol>
      </main>
    </SiteShell>
  );
}
