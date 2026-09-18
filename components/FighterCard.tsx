import { crops, mutations, personalities } from "@/lib/game-data";
import type { Fighter } from "@/lib/game-types";

export default function FighterCard({ fighter }: { fighter: Fighter }) {
  return (
    <div
      className="rounded-xl bg-[#fff8dc] p-4"
    >
      <div className="text-lg font-bold">
        {
          mutations[fighter.mutation]
            .label
        }{" "}
        {crops[fighter.crop].emoji}{" "}
        {
          mutations[fighter.mutation]
            .name
        }{" "}
        {crops[fighter.crop].name}
      </div>

      <div className="mt-1 text-sm font-bold">
        {
          personalities[
            fighter.personality
          ].emoji
        }{" "}
        {
          personalities[
            fighter.personality
          ].name
        }
      </div>

      <div className="text-xs opacity-60">
        {
          personalities[
            fighter.personality
          ].description
        }
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
        <div>
          ❤️
          <br />
          {fighter.hp}
        </div>

        <div>
          ⚔️
          <br />
          {fighter.attack}
        </div>

        <div>
          🛡️
          <br />
          {fighter.defense}
        </div>

        <div>
          ⚡
          <br />
          {fighter.speed}
        </div>
      </div>
    </div>

  );
}
