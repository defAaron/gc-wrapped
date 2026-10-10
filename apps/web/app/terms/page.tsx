import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function TermsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="mx-auto max-w-2xl flex-1 px-6 py-10 prose prose-stone">
        <h1>Terms</h1>
        <p>
          You must be <strong>16 or older</strong> to use Kudos AI. You must have permission from everyone in the chat to
          upload exports and share awards about them.
        </p>
        <p>
          Kudos AI is not affiliated with, endorsed by, or sponsored by Telegram, Meta Messenger, Discord, or any
          other chat platform.
        </p>
        <p>This demo is provided as-is for entertainment. Do not upload chats you are not allowed to share.</p>
      </main>
      <SiteFooter />
    </div>
  );
}
