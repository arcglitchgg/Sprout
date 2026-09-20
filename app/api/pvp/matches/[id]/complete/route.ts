import { completePvpMatch } from "@/lib/pvp-server";
import { socialRoute } from "@/lib/social-server";

type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, context: Context) {
  return socialRoute(request, async (actor) => completePvpMatch(actor, (await context.params).id));
}
