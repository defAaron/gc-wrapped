import { SiteHeader } from "@/components/site-header";

export default function TelegramExportPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-6 py-10 prose prose-stone">
        <h1>Telegram export</h1>
        <ol>
          <li>Open Telegram Desktop.</li>
          <li>Export chat history as JSON.</li>
          <li>Upload the folder&apos;s <code>result.json</code> file.</li>
        </ol>
      </main>
    </div>
  );
}
