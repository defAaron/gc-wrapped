import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="kudos-footer">
      <p>Kudos AI is a demo for people 16+. Not affiliated with Telegram, Messenger, or Discord.</p>
      <nav>
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
      </nav>
    </footer>
  );
}
