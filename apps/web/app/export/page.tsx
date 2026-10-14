import Link from "next/link";
import { SiteShell } from "@/components/site-shell";

const platforms = [
  { href: "/export/telegram", title: "Telegram", mark: "T", detail: "Upload result.json from Telegram Desktop." },
  { href: "/export/messenger", title: "Messenger", mark: "M", detail: "Upload a single message_1.json file." },
  { href: "/export/discord", title: "Discord", mark: "D", detail: "Use DiscordChatExporter JSON." },
];

export default function ExportHubPage() {
  return (
    <SiteShell>
      <main className="kudos-main">
        <h1 className="kudos-title">How do I get JSON?</h1>
        <p className="kudos-lede">
          Kudos AI accepts one <span className="kudos-inline-code">.json</span> file per upload. Pick your platform or
          use Kudos Chat JSON v1.
        </p>
        <ul className="kudos-list">
          {platforms.map((platform) => (
            <li key={platform.href}>
              <Link href={platform.href} className="kudos-card kudos-platform">
                <span className="kudos-avatar" aria-hidden="true">
                  <span>{platform.mark}</span>
                </span>
                <span className="kudos-platform-copy">
                  <span className="kudos-platform-title">{platform.title}</span>
                  <p>{platform.detail}</p>
                </span>
                <span className="kudos-platform-arrow" aria-hidden="true">
                  ↗
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </SiteShell>
  );
}
