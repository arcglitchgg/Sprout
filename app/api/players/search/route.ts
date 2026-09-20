import { searchPlayers, socialRoute } from "@/lib/social-server";

export async function GET(request: Request) {
  return socialRoute(request, (actor) => searchPlayers(actor, new URL(request.url).searchParams.get("q") ?? ""));
}
