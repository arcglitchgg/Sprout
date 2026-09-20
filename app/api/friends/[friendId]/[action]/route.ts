import { changeFriendship, SocialError, socialRoute } from "@/lib/social-server";

export async function POST(request: Request, context: { params: Promise<{ friendId: string; action: string }> }) {
  return socialRoute(request, async (actor) => {
    const { friendId, action } = await context.params;
    if (action !== "accept" && action !== "decline" && action !== "cancel") throw new SocialError(400, "Unknown friendship action.");
    return changeFriendship(actor, friendId, action);
  });
}
