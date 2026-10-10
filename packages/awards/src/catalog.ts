export type AwardId =
  | "most_messages"
  | "least_messages"
  | "fastest_replier"
  | "slowest_replier"
  | "late_night_texter"
  | "early_bird"
  | "link_lord"
  | "double_texter"
  | "caps_champion"
  | "emoji_overload"
  | "meme_dealer"
  | "funniest"
  | "hype_person"
  | "drama_starter"
  | "peacemaker"
  | "planner"
  | "chaos_gremlin"
  | "heart_of_group";

export type AwardDraft = {
  awardId: AwardId;
  title: string;
  winnerMemberId: string;
  runnerUpMemberId?: string;
  source: "code";
  margin: number;
  receipts: string[];
};

export const AWARD_TITLES: Record<AwardId, string> = {
  most_messages: "The Human Notification",
  least_messages: "Ghost of the Year",
  fastest_replier: "Speed-Reply Demon",
  slowest_replier: "Seen-zoned",
  late_night_texter: "After Hours CEO",
  early_bird: "Alarm Clock Energy",
  link_lord: "Link Dealer",
  double_texter: "Bubble Assault",
  caps_champion: "CAPS LOCK ENTHUSIAST",
  emoji_overload: "Emoji Tax Evader",
  meme_dealer: "Meme Supplier",
  funniest: "Funniest (Allegedly)",
  hype_person: "Hype Man / Woman / Them",
  drama_starter: "Main Character Energy",
  peacemaker: "The “Guys Chill”",
  planner: "Trip Admin",
  chaos_gremlin: "Chaos Gremlin",
  heart_of_group: "Group Chat Glue",
};

export const DETERMINISTIC_AWARDS: AwardId[] = [
  "most_messages",
  "least_messages",
  "fastest_replier",
  "slowest_replier",
  "late_night_texter",
  "early_bird",
  "link_lord",
  "double_texter",
  "caps_champion",
  "emoji_overload",
  "meme_dealer",
  "hype_person",
];
