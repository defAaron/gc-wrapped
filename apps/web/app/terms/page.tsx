import { SiteShell } from "@/components/site-shell";

export default function TermsPage() {
  return (
    <SiteShell>
      <main className="kudos-main kudos-copy">
        <h1 className="kudos-title">Terms</h1>
        <p>
          You must be <strong>16 or older</strong> to use Kudos AI. You must have permission from everyone in the chat to
          upload exports and share awards about them.
        </p>
        <p>
          Kudos AI is not affiliated with, endorsed by, or sponsored by Telegram, Meta Messenger, Discord, or any other
          chat platform.
        </p>
        <p>This demo is provided as-is for entertainment. Do not upload chats you are not allowed to share.</p>
      </main>
    </SiteShell>
  );
}
