import { SiteHeader } from "@/components/site-header";

export default function DiscordExportPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-6 py-10 prose prose-stone">
        <h1>Discord export</h1>
        <p>Export with DiscordChatExporter as JSON.</p>
        <p>Kudos AI doesn&apos;t connect to Discord — only upload files you exported yourself.</p>
      </main>
    </div>
  );
}
