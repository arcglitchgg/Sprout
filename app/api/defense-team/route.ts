import { getDefenseTeam, setDefenseTeam, socialBody, socialRoute } from "@/lib/social-server";

export async function GET(request: Request) {
  return socialRoute(request, getDefenseTeam);
}

export async function PUT(request: Request) {
  return socialRoute(request, async (actor) => setDefenseTeam(actor, (await socialBody(request)).fighterIds));
}
