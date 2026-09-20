import { listFriends, socialRoute } from "@/lib/social-server";

export async function GET(request: Request) {
  return socialRoute(request, listFriends);
}
