import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

const platforms = [
  { href: "/export/telegram", title: "Telegram", detail: "Upload `result.json` from Telegram Desktop." },
  { href: "/export/messenger", title: "Messenger", detail: "Upload a single `message_1.json` file." },
  { href: "/export/discord", title: "Discord", detail: "Use DiscordChatExporter JSON." },
];

export default function ExportHubPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="text-3xl font-semibold">How do I get JSON?</h1>
        <p className="mt-2 text-stone-600">
          Kudos AI accepts one `.json` file per upload. Pick your platform or use Kudos Chat JSON v1.
        </p>
        <ul className="mt-8 space-y-4">
          {platforms.map((platform) => (
            <li key={platform.href}>
              <Link href={platform.href} className="block rounded-2xl border border-stone-200 bg-white p-4">
                <span className="font-medium">{platform.title}</span>
                <p className="text-sm text-stone-600">{platform.detail}</p>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
