import { PLAYER_AVATARS, resolvePlayerAvatar } from "@/lib/player-avatar-data";

function AvatarPreview({ avatarId }: { avatarId: string }) {
  const avatar = resolvePlayerAvatar(avatarId);
  const scale = 64 / avatar.frameWidth;
  return <span className="relative block h-16 w-16 overflow-hidden" aria-hidden="true">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img alt="" src={avatar.spritePath} draggable={false} className="absolute max-w-none" style={{ width: avatar.sheetWidth * scale, height: avatar.sheetHeight * scale, imageRendering: "pixelated" }} />
  </span>;
}

export default function PlayerAvatarSelector({ selectedId, onSelect }: { selectedId: string; onSelect: (id: string) => void }) {
  return <section className="mt-5 border-t border-[#765438]/20 pt-4">
    <h4 className="font-black">Character</h4>
    <p className="mt-1 text-xs opacity-70">Choose your overworld farmer.</p>
    <div className="mt-3 grid grid-cols-3 gap-2 min-[440px]:grid-cols-4 sm:grid-cols-6">
      {PLAYER_AVATARS.map((avatar) => {
        const selected = avatar.id === selectedId;
        return <button key={avatar.id} type="button" onClick={() => onSelect(avatar.id)} aria-pressed={selected} aria-label={`Use ${avatar.name}`} className={`relative flex min-w-0 flex-col items-center rounded-xl border-2 p-2 text-xs font-bold ${selected ? "border-[#4f772d] bg-[#d9ed92]" : "border-transparent bg-white/55 hover:border-[#765438]/40"}`}>
          <AvatarPreview avatarId={avatar.id} />
          <span className="mt-1 w-full truncate">{avatar.name}</span>
          {selected && <span className="absolute right-1 top-1 rounded-full bg-[#4f772d] px-1.5 py-0.5 text-white" aria-hidden="true">✓</span>}
        </button>;
      })}
    </div>
  </section>;
}
