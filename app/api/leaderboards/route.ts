import { getLeaderboard } from "@/lib/pvp-server";
import { socialRoute } from "@/lib/social-server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  return socialRoute(request, (actor) => getLeaderboard(actor, url.searchParams.get("category"), url.searchParams.get("scope")));
}
