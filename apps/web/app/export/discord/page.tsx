import { SiteShell } from "@/components/site-shell";

export default function DiscordExportPage() {
  return (
    <SiteShell>
      <main className="kudos-main kudos-copy">
        <h1 className="kudos-title">Discord export</h1>
        <p>Export with DiscordChatExporter as JSON.</p>
        <p>Kudos AI doesn&apos;t connect to Discord — only upload files you exported yourself.</p>
      </main>
    </SiteShell>
  );
}
