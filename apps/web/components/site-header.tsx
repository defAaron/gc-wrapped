import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
      <Link href="/" className="text-sm font-semibold tracking-wide text-stone-700">
        Kudos AI
      </Link>
      <Link href="/export" className="text-sm text-stone-600 underline-offset-4 hover:underline">
        How do I get JSON?
      </Link>
    </header>
  );
}
