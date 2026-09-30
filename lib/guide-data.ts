export const GUIDE_TOPICS = [
  { id: "getting-started", title: "Getting Started", body: "Buy seeds, plant unlocked plots, harvest crops, then sell them at the Market or awaken them at the Farmhouse." },
  { id: "farming", title: "Farming", body: "Planting consumes one owned seed. Crops keep growing from their planted timestamp even while Sprout is closed." },
  { id: "mutations", title: "Mutations", body: "Harvests can be Normal, Large, Golden, or Prismatic. Higher rarities sell for more and awaken into stronger fighters." },
  { id: "awakening", title: "Awakening", body: "Awaken harvested crops at the Farmhouse for coins. The crop is consumed and becomes a Level 1 fighter with a random personality." },
  { id: "fighters", title: "Fighters", body: "Species, rarity, personality, and level shape combat stats. Heavy Slam grows with HP, Backstab grows with Speed, and Kernel Burst scales heavily with ATK. Dungeon victories give XP only to the three participating fighters." },
  { id: "personalities", title: "Personalities", body: "Angry, Protective, Lazy, Clever, and Mean fighters choose targets and actions differently. Clever fighters use skills more often and favor tactically valuable actions." },
  { id: "fusion", title: "Fusion", body: "Fuse four unlocked fighters of the same species and rarity. The four inputs are replaced by one newly generated fighter." },
  { id: "ascension", title: "Ascended + Ascension pity", body: "Four Prismatic fighters can produce Ascended. Each species has separate pity, and its third attempt is guaranteed after two failures." },
  { id: "active-team", title: "Active Team", body: "Set Front, Rear Left, and Rear Right at the Farmhouse. This team becomes the default for Dungeon and PvP, but can be overridden per battle." },
  { id: "dungeon", title: "Dungeon", body: "Clear Floors 1–20 in order. Cleared floors remain replayable for fighter XP, with bosses on Floors 5, 10, 15, and 20." },
  { id: "pvp", title: "PvP", body: "Challenge a live player, choose three fighters, and battle from authoritative saved snapshots. PvP does not award fighter XP." },
  { id: "defense-team", title: "Defense Team", body: "Defense Team is configured in Neighborhood and stays independent from Active Team. It uses your latest cloud-saved roster." },
] as const;

export type GuideTopicId = (typeof GUIDE_TOPICS)[number]["id"];

export const PATCH_NOTES = [{
  version: "Fighter Growth & Individuality",
  date: "September 2026",
  bullets: [
    "Increased species HP so battles have more room for personality and tactics",
    "Newly awakened and fused fighters now receive permanent natural stat variation",
    "Species-specific growth ceilings preserve each fighter's long-term identity",
    "Potato remains tank-focused, Carrot remains Speed-focused, and Corn remains ATK-focused",
    "Existing fighters keep their stored natural stats",
  ],
}, {
  version: "Combat Identity Rebalance",
  date: "September 2026",
  bullets: [
    "Effective Speed now scales up to 100 before reaching the action-speed cap",
    "Potato Heavy Slam now grows stronger with HP",
    "Carrot Backstab now grows stronger with Speed",
    "Corn Kernel Burst remains focused on ATK",
    "Clever fighters use skills more often instead of gaining bonus skill damage",
  ],
}, {
  version: "Roster & Progression Update",
  date: "September 2026",
  bullets: [
    "Fighter Levels and Dungeon XP",
    "Dungeon Floors 1–20 with boss floors",
    "Ascended rarity and species-based Ascension pity",
    "Fighter Lock, Release, and organized Fusion groups",
    "Persistent Active Team defaults",
    "Silent Sprout session renewal and disconnect handling",
  ],
}] as const;
