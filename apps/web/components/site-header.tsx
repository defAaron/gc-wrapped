import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="kudos-nav">
      <Link className="kudos-brand" href="/" aria-label="Kudos AI home">
        <span className="kudos-brand-mark">
          <span>✦</span>
        </span>
        <span>Kudos AI</span>
      </Link>
      <Link className="kudos-nav-link" href="/export">
        How do I get JSON?
      </Link>
    </header>
  );
}
