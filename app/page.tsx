import SproutGame from "@/components/SproutGame";
import DiscordProvider from "@/components/DiscordProvider";

export default function Home() {
  return <DiscordProvider><SproutGame /></DiscordProvider>;
}
