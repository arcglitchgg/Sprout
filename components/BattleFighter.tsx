import { crops, personalities } from "@/lib/game-data";
import { FORMATION } from "@/lib/battle-data";
import type { BattleAnimationName } from "@/lib/battle-sprite-data";
import type { Fighter } from "@/lib/game-types";
import BattleDialogue from "@/components/BattleDialogue";
import BattleSprite from "@/components/BattleSprite";

export default function BattleFighter({ fighter, hp, slot, dialogue, impact, shield, moving, animationKey, animation, scale = 1 }: {
  fighter: Fighter; hp: number; slot: number; dialogue?: string; impact?: string; shield: boolean; moving: boolean; animationKey: number | null; animation?: BattleAnimationName; scale?: number;
}) {
  return <div className="relative flex w-28 flex-col items-center text-center">
    {dialogue && <BattleDialogue text={dialogue} />}
    <span className="text-[10px] uppercase tracking-wide">{FORMATION[slot]}</span>
    <div key={impact ? animationKey : "rest"} style={{ transform: `scale(${scale})`, transformOrigin: "bottom center" }} className={`${impact ?? ""} ${hp === 0 ? "battle-ko" : ""} ${moving ? "opacity-0" : ""}`}>
      <BattleSprite fighter={fighter} animation={hp === 0 ? "idle" : animation} playbackKey={animationKey} paused={hp === 0} />
    </div>
    {shield && <span className="absolute top-3 right-2 text-xl" aria-label="Intercepting">🛡️</span>}
    <strong className="text-xs">{crops[fighter.crop].name}{hp === 0 ? " · KO" : ""}</strong>
    <span className="text-[10px]">{personalities[fighter.personality].name}</span>
    <progress aria-label={`${crops[fighter.crop].name} ${FORMATION[slot]} HP`} max={fighter.hp} value={hp} className="h-2 w-24 accent-[#4f772d]" />
    <span className="text-[10px]">{hp}/{fighter.hp}</span>
  </div>;
}
