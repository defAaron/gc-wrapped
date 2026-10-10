import { SiteHeader } from "@/components/site-header";

export default function MessengerExportPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-6 py-10 prose prose-stone">
        <h1>Messenger export</h1>
        <p>Download your information from Meta as JSON, then upload a single <code>message_1.json</code>.</p>
      </main>
    </div>
  );
}
