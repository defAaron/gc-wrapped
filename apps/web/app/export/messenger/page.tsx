import { SiteShell } from "@/components/site-shell";

export default function MessengerExportPage() {
  return (
    <SiteShell>
      <main className="kudos-main kudos-copy">
        <h1 className="kudos-title">Messenger export</h1>
        <p>
          Download your information from Meta as JSON, then upload a single <code>message_1.json</code>.
        </p>
      </main>
    </SiteShell>
  );
}
