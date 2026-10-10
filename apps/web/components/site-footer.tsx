import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mx-auto w-full max-w-5xl px-6 py-8 text-center text-xs text-stone-500">
      <p className="mb-2">Kudos AI is a demo for people 16+. Not affiliated with Telegram, Messenger, or Discord.</p>
      <nav className="flex justify-center gap-4">
        <Link href="/privacy" className="underline-offset-2 hover:underline">Privacy</Link>
        <Link href="/terms" className="underline-offset-2 hover:underline">Terms</Link>
      </nav>
    </footer>
  );
}
