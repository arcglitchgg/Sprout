# Sprout game design direction

This document describes the intended progression and economy. **Planned values and features below are not implemented unless the Current state section says otherwise.** Keep existing gameplay working while adding them in stages.

## Progression loop

Plant → Harvest → Sell **or** Awaken → Build a fighter roster → Dungeon → Fighter XP, levels, and skills → Fusion → Higher-rarity fighters → PvP → Return to farming.

Farming remains the source of crops, mutations, coins, and fighter candidates. Selling creates spending power; awakening and later roster development consume it. Dungeon develops fighters after awakening. PvP gives purpose and status, rather than becoming the easiest source of farming resources. A strong roster should increase demand for farming, not replace it.

```text
Plant → harvest mutated crops
            ├─ Sell at Market → coins ──────────┐
            └─ Awaken at Farmhouse ← coin cost ──┘
                    ↓
                 Fighter → Dungeon → Fighter XP / skills
                    ↓                         ↓
               Collect duplicates ←───────────┘
                    ↓
                  Fusion → higher rarity → PvP
                    └──────────────────────→ farming
```

## Current state (September 2026)

- Harvested crops enter an individual-item inventory. The Market sells them; the Farmhouse awakens them for a rarity-based coin cost.
- Farm Level uses account-wide Farm XP and unlocks plots. It is distinct from the proposed per-fighter XP and levels.
- Dungeon has 20 sequential, replayable floors with boss encounters on Floors 5, 10, 15, and 20. Victories award 20 coins, 15 Farm XP, and floor-scaled Fighter XP to the three participants on a once-only battle boundary.
- Each current species has Basic Attack and one weighted auto-cast skill. Personalities influence choices and targeting. Skills are available immediately; level-based unlocks do not exist.
- Fusion accepts four fighters of one species and one tier. Four Normal yield 70% Normal / 30% Large; four Large have a 30% Golden chance; four Golden have a 25% Prismatic chance; four Prismatic have a 35% Ascended chance with a guaranteed result on that species' third attempt. Failures return the input tier. Ascended cannot fuse further. Fusion grants no Farm XP.
- PvP uses stored fighter snapshots and seeded battle resolution. A server-finalized winner receives one persistent PvP Win; PvP grants no coins, Farm XP, or fighter XP. There is no PvP rank or season system.
- Save V3 stores farm state, Ascension pity, and fighter level/XP. V1 and V2 saves migrate forward without regenerating fighters; migrated fighters begin at Level 1 with 0 XP.

## Coin economy and awakening

Selling harvested crops remains the primary repeatable coin source. Awakening will become a meaningful coin sink: players choose immediate income or an investment in a fighter. Initial **playtest targets**, not permanent prices:

| Mutation | Proposed awakening cost |
| --- | ---: |
| Normal | 20 coins |
| Large | 40 coins |
| Golden | 100 coins |
| Prismatic | 250 coins |

The Farmhouse should show the cost before confirmation. If coins are insufficient, keep the crop in inventory and explain why awakening is unavailable. Generate the fighter successfully before committing coin deduction and item removal in one state transaction. Preserve existing mutation odds, crop sale values, seed prices, and harvest behavior unless a later balance decision explicitly changes them. Coin sinks should create choices without blocking experimentation entirely.

## Rarity and fusion

Playtests produced multiple Prismatic crops and fighters within roughly a day. Prismatic should stay exciting, but it is not the final endgame tier. Do not sharply reduce its harvest odds solely to add grind. Add a highest fighter rarity with the working name **Ascended**; the final name is open.

Ascended cannot be harvested directly. Four awakened Prismatic fighters of the same species fuse with a **35% Ascended chance**; the third attempt for that species is guaranteed if the first two failed. Failure returns one Prismatic fighter. Pity is independent for Potato, Carrot, and Corn and resets on success. Harvested crops cannot be used directly as fusion inputs.

Long-term tier path:

| Inputs, same species and tier | Intended result |
| --- | --- |
| 4 Normal | Chance to upgrade to Large; current 70% Normal / 30% Large |
| 4 Large | 30% Golden; otherwise Large |
| 4 Golden | 25% Prismatic; otherwise Golden |
| 4 Prismatic | 35% Ascended; otherwise Prismatic; guaranteed on the species' third attempt |

These are initial balance values. Evaluate bad-luck protection for repeated lower-tier failures during playtesting. Avoid stacking excessive RNG on top of rare inputs; the Ascended hard pity limits the highest-tier streak.

Ascended should offer aspiration without invalidating lower tiers or guaranteeing a PvP win. Its initial fighter stat multiplier is **15% above Prismatic** and remains adjustable. Distinctive art, aura/frame/nameplate, battle effects, and a possible signature skill are future ideas, not current mechanics. Team composition, personality, and skill choice must remain relevant.

## Fighter development and Dungeon

Keep **rarity** (how exceptional a fighter is) separate from **level** (how much it has trained). A newly fused Level 1 Ascended fighter should still need Dungeon participation to unlock its potential. Dungeon should become the main source of per-fighter XP, stage/floor progression, and perhaps skill materials or first-clear rewards later. It should not become the dominant coin farm; its current 20-coin victory reward needs review when the economy changes.

Fighter XP is cumulative and has no current level cap. The next-level requirement is `50 + 30 × (current level - 1)`. Effective HP, ATK, DEF, and Speed gain 3% per level above Level 1 while generated stats remain stable base values. A small illustrative unlock schedule is Basic Attack at Level 1, Skill 1 at Level 3, Skill 2 at Level 6, and a signature skill at Level 10. These skill levels are placeholders. Aim for about two or three meaningful unlockable species skills plus signature behavior, not a large skill tree. Keep weighted auto-cast selection, battlefield-aware weights, and personality-driven targeting as skills expand.

PvP should initially give no fighter XP, or very little if testing later supports it, so players cannot level fighters by repeatedly challenging friends.

## Design constraints

- Farming stays useful at every progression stage; combat progression must not obsolete it.
- PvP provides status and competition, not an easier route to coins, crops, or fighter training.
- Do not stack punishing RNG on rare materials. In particular, the third same-species Prismatic fusion guarantees Ascended.
- New rarity tiers should add aspiration without erasing value in previously trained fighters.
- Coin sinks should create decisions while leaving room to experiment with teams.
- Keep the first expansion small; tune costs, odds, level curves, and stat advantage from playtests.

## Implementation order and migration notes

1. Add awakening cost display and an atomic affordability/creation transaction, with tests for insufficient coins, item retention, and no duplicate charge.
2. Design Save V3 for fighter XP/level. Migrate V2 fighters to a defensible starting level without reconstructing historical Dungeon participation. Update validation, cloud-save handling, and combat snapshot compatibility together.
3. Add per-fighter Dungeon XP and a small level curve with once-only battle rewards. Keep Farm XP separate and make participant attribution explicit.
4. Gate the existing skill by level only when level progression is ready, then add a small set of species skills. Preserve weighted selection and personality behavior.
5. Playtest the implemented fusion odds and Ascension pity; adjust centralized probabilities only with balance evidence.
6. Balance Ascended stats and visuals against PvP, Combat Power, and lower-rarity trained teams. Verify old and new fighter snapshots remain replayable before changing live battle rules.

These changes will touch fighter types and generation, fusion, Farmhouse UI, persistence and cloud validation, battle balancing, and PvP Combat Power. Treat each as a staged change; do not infer new mechanics from this document alone.
