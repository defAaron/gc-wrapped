import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="mx-auto max-w-2xl flex-1 px-6 py-10 prose prose-stone">
        <h1>Privacy</h1>
        <p>
          Kudos AI is a demo. We do not keep your raw JSON upload after analysis. Session data and awards are retained
          for up to <strong>30 days</strong>, then deleted. Ceremony videos are kept for up to <strong>7 days</strong>.
        </p>
        <p>
          AI providers receive only compact summaries needed for the product: TypeSafe Jev gets structured stats and
          short exemplar snippets for judging; Magic Hour gets ceremony script lines, TTS audio, and avatars you upload
          for video rendering. We do not sell your data.
        </p>
        <p>
          To delete your session, use delete-in-product on your session page when available, or email{" "}
          <a href="mailto:privacy@kudos.ai">privacy@kudos.ai</a> (placeholder contact for the demo).
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
