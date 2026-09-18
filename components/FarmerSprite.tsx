import { WORLD_SPRITE_SHEETS } from "@/lib/sprite-data";

export default function FarmerSprite({ frame, facing, moving }: { frame: number; facing: "left" | "right"; moving: boolean }) {
  const sheet = WORLD_SPRITE_SHEETS.farmer;
  const column = frame % 4;
  const row = Math.floor(frame / 4);
  return (
    <div className="pointer-events-none absolute z-30 h-16 w-16" style={{ transform: "translate(-50%, -100%)" }} aria-label={`Farmer ${moving ? "walking" : "standing"}`}>
      <div className="relative h-16 w-16 overflow-hidden" style={{ transform: facing === "left" ? "scaleX(-1)" : undefined }}>
        {/* Exact-size sprite-sheet crop; dedicated files can replace this later. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt=""
          draggable={false}
          src={sheet.src}
          className="absolute max-w-none"
          style={{
            width: sheet.width * 2,
            height: sheet.height * 2,
            left: -column * sheet.frameWidth * 2,
            top: -row * sheet.frameHeight * 2,
            imageRendering: "pixelated",
          }}
        />
      </div>
    </div>
  );
}
