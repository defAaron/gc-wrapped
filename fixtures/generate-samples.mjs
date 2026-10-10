/**
 * Regenerates synthetic Kudos Chat JSON v1 fixtures (no real PII).
 * Run: node fixtures/generate-samples.mjs
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)));

function iso(baseDate, dayOffset, hour, minute) {
  const d = new Date(baseDate);
  d.setUTCDate(d.getUTCDate() + dayOffset);
  d.setUTCHours(hour, minute, 0, 0);
  return d.toISOString();
}

function buildKudos({ filename, title, members, messages }) {
  const doc = {
    kudos_version: "1",
    chat: {
      title,
      platform: "kudos",
      exported_at: "2025-10-01T12:00:00.000Z",
    },
    members: members.map(({ id, display_name }) => ({ id, display_name })),
    messages,
  };
  const path = join(root, filename);
  writeFileSync(path, `${JSON.stringify(doc, null, 2)}\n`);
  console.log(`wrote ${filename} (${messages.length} messages, ${members.length} members)`);
}

const base = "2024-08-01T12:00:00.000Z";

/** Smoke test: upload + parse in seconds */
buildKudos({
  filename: "sample-minimal.json",
  title: "Coffee Run",
  members: [
    { id: "nia", display_name: "Nia" },
    { id: "leo", display_name: "Leo" },
    { id: "zoe", display_name: "Zoe" },
  ],
  messages: [
    { id: "1", ts: iso(base, 0, 14, 5), author_id: "nia", text: "who is free for coffee", type: "message" },
    { id: "2", ts: iso(base, 0, 14, 7), author_id: "leo", text: "me in 10", type: "message" },
    { id: "3", ts: iso(base, 0, 14, 8), author_id: "zoe", text: "same", type: "message" },
    { id: "4", ts: iso(base, 0, 14, 12), author_id: "nia", text: "meet at the corner cart", type: "message" },
    { id: "5", ts: iso(base, 0, 14, 20), author_id: "leo", text: "lol I forgot my wallet", type: "message" },
    { id: "6", ts: iso(base, 0, 14, 21), author_id: "leo", text: "jk I have apple pay", type: "message" },
    { id: "7", ts: iso(base, 0, 22, 40), author_id: "zoe", text: "still up?", type: "message" },
    { id: "8", ts: iso(base, 0, 23, 15), author_id: "nia", text: "heading home", type: "message" },
    { id: "9", ts: iso(base, 1, 9, 0), author_id: "zoe", text: "thanks again yesterday", type: "message" },
    { id: "10", ts: iso(base, 1, 9, 4), author_id: "leo", text: "anytime", type: "message" },
    { id: "11", ts: iso(base, 1, 12, 30), author_id: "nia", text: "https://example.com/menu", type: "message" },
    { id: "12", ts: iso(base, 1, 12, 45), author_id: "zoe", text: "vote: oat or almond", type: "message" },
  ],
});

/** Three friends, skewed talkers — good for quick award preview */
(() => {
  const members = [
    { id: "taylor", display_name: "Taylor" },
    { id: "priya", display_name: "Priya" },
    { id: "devon", display_name: "Devon" },
  ];
  const lines = [
    ["taylor", "brunch this weekend?"],
    ["priya", "maybe sat"],
    ["devon", "ok"],
    ["taylor", "I will find a spot"],
    ["taylor", "https://example.com/brunch"],
    ["priya", "lol that place again"],
    ["taylor", "it hits though"],
    ["devon", "fine"],
    ["priya", "I can drive"],
    ["taylor", "legend"],
    ["taylor", "also who has my charger"],
    ["devon", "not me"],
    ["priya", "check the couch"],
    ["taylor", "found it"],
    ["taylor", "never mind"],
  ];
  const messages = [];
  let id = 1;
  for (let day = 0; day < 5; day += 1) {
    for (const [authorId, text] of lines) {
      const hour = 10 + (id % 12);
      const minute = (id * 7) % 60;
      messages.push({
        id: String(id),
        ts: iso(base, day, hour, minute),
        author_id: authorId,
        text,
        type: "message",
        ...(id === 20 ? { reactions: [{ emoji: "😂", count: 3 }] } : {}),
        ...(id === 21 ? { reply_to_id: "20" } : {}),
      });
      id += 1;
    }
  }
  messages.push({
    id: String(id),
    ts: iso(base, 5, 2, 30),
    author_id: "priya",
    text: "Taylor added a poll",
    type: "system",
  });
  buildKudos({
    filename: "sample-trio-quick.json",
    title: "Brunch Committee",
    members,
    messages,
  });
})();

/** Four roommates — links, late night, double texts */
(() => {
  const members = [
    { id: "maya", display_name: "Maya" },
    { id: "eli", display_name: "Eli" },
    { id: "noah", display_name: "Noah" },
    { id: "jules", display_name: "Jules" },
  ];
  const pool = [
    ["maya", "trash night reminder"],
    ["eli", "on it"],
    ["noah", "can someone grab paper towels"],
    ["jules", "adding to the list"],
    ["maya", "https://example.com/grocery"],
    ["eli", "lol we always forget dish soap"],
    ["noah", "haha"],
    ["jules", "I got soap"],
    ["maya", "who left the stove on"],
    ["eli", "not me this time"],
    ["noah", "my bad"],
    ["jules", "all good just vent the kitchen"],
    ["maya", "vote: pizza or tacos"],
    ["eli", "tacos"],
    ["noah", "tacos"],
    ["jules", "pizza"],
    ["maya", "tacos win"],
    ["eli", "nice"],
  ];
  const messages = [];
  let id = 1;
  for (let day = 0; day < 8; day += 1) {
    for (const [authorId, text] of pool) {
      const late = id % 17 === 0;
      const hour = late ? 1 + (id % 3) : 9 + (id % 10);
      messages.push({
        id: `m${id}`,
        ts: iso(base, day, hour, id % 60),
        author_id: authorId,
        text,
        type: "message",
      });
      id += 1;
      if (authorId === "maya" && id % 11 === 0) {
        messages.push({
          id: `m${id}`,
          ts: iso(base, day, hour, (id % 60) + 1),
          author_id: "maya",
          text: "double text because I remembered the lease form",
          type: "message",
        });
        id += 1;
      }
    }
  }
  buildKudos({
    filename: "sample-roommates.json",
    title: "2B Kitchen Sync",
    members,
    messages,
  });
})();

/** Five-person study group — enough volume for fuller award deck */
(() => {
  const members = [
    { id: "alex", display_name: "Alex" },
    { id: "sam", display_name: "Sam" },
    { id: "jordan", display_name: "Jordan" },
    { id: "riley", display_name: "Riley" },
    { id: "casey", display_name: "Casey" },
  ];
  const authors = members.map((m) => m.id);
  const snippets = [
    "library at 3?",
    "bringing snacks",
    "I forgot the reading",
    "same",
    "https://example.com/slides",
    "this problem set is long",
    "lol",
    "haha ok",
    "can we do a quick call",
    "I am free after 8",
    "quiet hours please",
    "sorry",
    "who has the notes from tuesday",
    "uploading now",
    "vote: review friday or sunday",
  ];
  const messages = [];
  for (let i = 1; i <= 160; i += 1) {
    const authorId = authors[i % authors.length];
    const skew = authorId === "alex" ? snippets[i % snippets.length] : snippets[(i + 3) % snippets.length];
    const text = i % 23 === 0 ? "lmao wait" : skew;
    messages.push({
      id: `s${i}`,
      ts: iso(base, Math.floor(i / 25), 8 + (i % 14), i % 60),
      author_id: authorId,
      text,
      type: "message",
      ...(i === 50 ? { reactions: [{ emoji: "💀", count: 4 }] } : {}),
    });
  }
  buildKudos({
    filename: "sample-study-group.json",
    title: "CS301 Study Hall",
    members,
    messages,
  });
})();
