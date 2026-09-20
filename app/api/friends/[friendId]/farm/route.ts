import { getFriendFarm, socialRoute } from "@/lib/social-server";

export async function GET(request: Request, context: { params: Promise<{ friendId: string }> }) {
  return socialRoute(request, async (actor) => getFriendFarm(actor, (await context.params).friendId));
}
