import type { GuideTopicId } from "@/lib/guide-data";

export default function HelpButton({ topic, onOpen, label = topic, className = "" }: { topic: GuideTopicId; onOpen: (topic: GuideTopicId) => void; label?: string; className?: string }) {
  return <button type="button" onClick={() => onOpen(topic)} aria-label={`Help: ${label}`} title={`Help: ${label}`} className={`inline-flex h-6 w-6 items-center justify-center rounded-full border border-current/30 text-xs font-black hover:bg-white/20 ${className}`}>?</button>;
}
