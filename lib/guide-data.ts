import { AWAKENING_COSTS } from "@/lib/awakening";
import { ASCENSION_HARD_PITY, FUSION_UPGRADE_CHANCE } from "@/lib/fusion";

const percent = (value: number) => `${Math.round(value * 100)}%`;
const awakeningCosts = `Normal ${AWAKENING_COSTS.normal}, Large ${AWAKENING_COSTS.large}, Golden ${AWAKENING_COSTS.golden}, and Prismatic ${AWAKENING_COSTS.prismatic} Coins.`;
const fusionOdds = `Normal → Large ${percent(FUSION_UPGRADE_CHANCE.normal)}, Large → Golden ${percent(FUSION_UPGRADE_CHANCE.large)}, Golden → Prismatic ${percent(FUSION_UPGRADE_CHANCE.golden)}, and Prismatic → Ascended ${percent(FUSION_UPGRADE_CHANCE.prismatic)}. Ascension is guaranteed on attempt ${ASCENSION_HARD_PITY} after two failures.`;

export const GUIDE_TOPICS = [
  {
    id: "how-to-play",
    title: "How to Play Sprout",
    body: "Follow the farm-to-fighter loop, improve your team, and take on progressively harder battles.",
    sections: [
      { title: "1. Start Farming", body: "Buy seeds at the Seed Shop, then choose an owned seed when you interact with an unlocked empty plot.", bullets: ["Plant and wait for the crop to grow.", "Harvest it when ready, or use Harvest All to collect every ready crop."] },
      { title: "2. Sell or Awaken", body: "Harvested crops enter your inventory and have two uses.", bullets: ["Sell at the Market to earn Coins for seeds and other economy actions.", "Awaken at the Farmhouse to spend Coins and create a Level 1 fighter matching the crop species.", `Current Awakening costs: ${awakeningCosts}`] },
      { title: "3. Understand Your Fighters", body: "Potato specializes in HP and DEF, Carrot specializes in Speed, and Corn specializes in ATK.", bullets: ["Angry favors aggressive damage; Protective defends and intercepts; Lazy hits harder but acts slower.", "Clever uses skills more often and tactically; Mean is stronger against weakened enemies.", "HP is survivability, ATK drives damage, DEF reduces damage, and Speed controls how often a fighter acts."] },
      { title: "4. Natural Stat Rolls", body: "New fighters receive permanent natural stat variation, so otherwise similar fighters can have different stats.", bullets: ["A species' signature stats have wider roll ranges.", "✦ MAX and the prismatic stat icon confirm the highest possible natural roll for that stat.", "Several stats can be MAX at once, and an all-MAX fighter is possible."] },
      { title: "5. Rarity", body: "Rarities progress through Normal, Large, Golden, Prismatic, and Ascended. Higher rarity increases fighter stats.", bullets: ["Ascended is available only through Fusion.", "Strong natural rolls can help a lower-rarity fighter compete with a weaker roll at the next rarity, though rarity remains important."] },
      { title: "6. Build Your Active Team", body: "Set three ordered slots—Front, Rear Left, and Rear Right—from the Farmhouse.", bullets: ["Dungeon and PvP can prefill their team from your Active Team.", "Choosing a different team for one battle does not overwrite the saved Active Team."] },
      { title: "7. Dungeon", body: "The Dungeon has 20 increasingly difficult floors, with bosses on Floors 5, 10, 15, and 20.", bullets: ["Victories grant Fighter XP to the three participating fighters.", "Losses and draws grant no Fighter XP.", "Cleared floors remain replayable for training."] },
      { title: "8. Fighter Levels", body: "Dungeon victories grant XP, and leveling improves combat stats with growth that slows over time.", bullets: ["Species retain different long-term strengths.", "Potato favors HP and DEF, Carrot favors Speed, and Corn favors ATK."] },
      { title: "9. Fusion", body: "Fuse four unlocked fighters of the same species and rarity. Locked fighters cannot be used as material.", bullets: ["Fusion can raise rarity and creates one newly generated fighter.", "Prismatic fighters can become Ascended; Ascended cannot fuse further.", fusionOdds] },
      { title: "10. PvP", body: "Challenge friends or other live players and choose a three-fighter team.", bullets: ["Battles resolve automatically from stats, personalities, skills, and Speed.", "Competitive PvP contributes to PvP wins and leaderboards; PvP does not grant Fighter XP."] },
      { title: "11. Recommended Beginner Loop", body: "Build progress through a simple repeating loop.", bullets: ["1. Plant crops", "2. Harvest", "3. Sell enough crops to fund seeds and Awakening", "4. Awaken fighters", "5. Compare rolls and personalities", "6. Build your Active Team", "7. Clear Dungeon floors", "8. Level and Fuse fighters", "9. Challenge other players", "10. Repeat and hunt better fighters"] },
    ],
  },
  { id: "getting-started", title: "Getting Started", body: "Buy seeds, plant unlocked plots, harvest crops, then sell them at the Market or awaken them at the Farmhouse." },
  { id: "farming", title: "Farming", body: "Planting consumes one owned seed. Crops keep growing from their planted timestamp even while Sprout is closed." },
  { id: "mutations", title: "Mutations", body: "Harvests can be Normal, Large, Golden, or Prismatic. Higher rarities sell for more and awaken into stronger fighters." },
  { id: "awakening", title: "Awakening", body: `Awaken harvested crops at the Farmhouse for Coins. The crop is consumed and becomes a Level 1 fighter with a random personality. ${awakeningCosts}` },
  { id: "fighters", title: "Fighters", body: "Species, rarity, personality, natural rolls, and level shape combat stats. Heavy Slam grows with HP, Backstab grows with Speed, and Kernel Burst scales heavily with ATK. Dungeon victories give XP only to the three participating fighters." },
  { id: "personalities", title: "Personalities", body: "Angry, Protective, Lazy, Clever, and Mean fighters choose targets and actions differently. Clever fighters use skills more often and favor tactically valuable actions." },
  { id: "fusion", title: "Fusion", body: `Fuse four unlocked fighters of the same species and rarity. The four inputs are replaced by one newly generated fighter. ${fusionOdds}` },
  { id: "ascension", title: "Ascended + Ascension pity", body: `Four Prismatic fighters can produce Ascended. Each species has separate pity, and attempt ${ASCENSION_HARD_PITY} is guaranteed after two failures.` },
  { id: "active-team", title: "Team Presets", body: "Save up to three ordered teams at the Farmhouse and choose one default. Dungeon and PvP prefill the default, while manual battle choices leave every preset unchanged." },
  { id: "favorites", title: "Favorites", body: "Favorite marks fighters for quick roster filtering. Locking is separate: locked fighters cannot be released, dismantled, or used as Fusion material." },
  { id: "ascendant-shards", title: "Ascendant Shards", body: "Dismantling an unlocked Ascended fighter grants one Ascendant Shard. Shards are stored for future cosmetics and special upgrades and have no gameplay use yet." },
  { id: "dungeon", title: "Dungeon", body: "Clear Floors 1–20 in order. Cleared floors remain replayable for fighter XP, with bosses on Floors 5, 10, 15, and 20. Losses and draws grant no Fighter XP." },
  { id: "pvp", title: "PvP", body: "Challenge a live player, choose three fighters, and battle from authoritative saved snapshots. Competitive wins contribute to PvP leaderboards. PvP does not award Fighter XP." },
  { id: "defense-team", title: "Defense Team", body: "Defense Team is configured in Neighborhood and stays independent from Active Team. It uses your latest cloud-saved roster." },
] as const;

export type GuideTopicId = (typeof GUIDE_TOPICS)[number]["id"];

export const PATCH_NOTES = [{
  version: "Roster & Progression QoL",
  date: "October 2026",
  bullets: [
    "Added fighter renaming, Favorites, and combined rarity, Favorites, and species roster filters",
    "Added three named team presets with one default, plus preset or manual team selection in Dungeon and PvP",
    "Fighter cards now show XP progress toward the next level",
    "Ascended fighters can be dismantled into Ascendant Shards for future cosmetics",
    "Locked Ascended fighters cannot be dismantled, and favorited fighters receive a stronger confirmation",
  ],
}, {
  version: "Gameplay Tutorial",
  date: "October 2026",
  bullets: ["Added a full beginner guide covering farming, Awakening, fighters, natural rolls, Dungeon, Fusion, and PvP."],
}, {
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
