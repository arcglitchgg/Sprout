export default function BattleDialogue({ text }: { text: string }) {
  return <div className="battle-speech absolute bottom-full left-1/2 z-40 mb-2 w-36 -translate-x-1/2 rounded-lg border-2 border-[#564532] bg-[#fff8dc] p-2 text-center text-xs text-[#2f3e2f]">{text}</div>;
}
