import { createPvpMatch } from "@/lib/pvp-server";
import { socialBody, socialRoute } from "@/lib/social-server";

export async function POST(request: Request) {
  return socialRoute(request, async (actor) => createPvpMatch(actor, await socialBody(request)));
}
