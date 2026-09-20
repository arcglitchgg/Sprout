import { changeFriendship, socialBody, SocialError, socialRoute } from "@/lib/social-server";

export async function POST(request: Request) {
  return socialRoute(request, async (actor) => {
    const body = await socialBody(request);
    if (typeof body.friendId !== "string") throw new SocialError(400, "A friend ID is required.");
    return changeFriendship(actor, body.friendId, "request");
  });
}
