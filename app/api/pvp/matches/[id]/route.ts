import { acceptPvpMatch, cancelPvpMatch, getPvpMatch, submitPvpTeam } from "@/lib/pvp-server";
import { socialBody, socialRoute } from "@/lib/social-server";

type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  return socialRoute(request, async (actor) => getPvpMatch(actor, (await context.params).id));
}
export async function POST(request: Request, context: Context) {
  return socialRoute(request, async (actor) => acceptPvpMatch(actor, (await context.params).id));
}
export async function PUT(request: Request, context: Context) {
  return socialRoute(request, async (actor) => submitPvpTeam(actor, (await context.params).id, await socialBody(request)));
}
export async function DELETE(request: Request, context: Context) {
  return socialRoute(request, async (actor) => cancelPvpMatch(actor, (await context.params).id));
}
