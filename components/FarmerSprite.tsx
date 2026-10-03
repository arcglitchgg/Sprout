import {
  DEFAULT_PLAYER_AVATAR_ID,
  getPlayerAvatarFrame,
  NEW_PLAYER_RENDER_SIZE,
  resolvePlayerAvatar,
} from "@/lib/player-avatar-data";
import type { PlayerMovementDirection } from "@/lib/player-avatar-data";

export default function FarmerSprite({ frame, facing, direction, moving, avatarId }: {
  frame: number;
  facing: "left" | "right";
  direction?: PlayerMovementDirection;
  moving: boolean;
  avatarId?: string;
}) {
  const sheet = resolvePlayerAvatar(avatarId);
  const legacy = sheet.id === DEFAULT_PLAYER_AVATAR_ID;
  const sourceFrame = getPlayerAvatarFrame(sheet.id, direction ?? facing, moving, frame);
  const column = sourceFrame % 4;
  const row = Math.floor(sourceFrame / 4);
  const renderSize = legacy ? 64 : NEW_PLAYER_RENDER_SIZE;
  const scale = renderSize / sheet.frameWidth;
  return (
    <div className="pointer-events-none absolute z-30 h-16 w-16" style={{ transform: "translate(-50%, -100%)" }} aria-label={`Farmer ${moving ? "walking" : "standing"}`}>
      <div className="absolute bottom-0 left-1/2 overflow-hidden" style={{
        width: renderSize,
        height: renderSize,
        transform: `translateX(-50%)${legacy && facing === "left" ? " scaleX(-1)" : ""}`,
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt=""
          draggable={false}
          src={sheet.spritePath}
          className="absolute max-w-none"
          style={{
            width: sheet.sheetWidth * scale,
            height: sheet.sheetHeight * scale,
            left: -column * sheet.frameWidth * scale,
            top: -row * sheet.frameHeight * scale,
            imageRendering: "pixelated",
          }}
        />
      </div>
    </div>
  );
}
