import { changeFriendship, socialRoute } from "@/lib/social-server";

export async function DELETE(request: Request, context: { params: Promise<{ friendId: string }> }) {
  return socialRoute(request, async (actor) => changeFriendship(actor, (await context.params).friendId, "remove"));
}
