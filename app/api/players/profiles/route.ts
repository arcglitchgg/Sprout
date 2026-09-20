import { lookupPlayerNames, socialRoute } from "@/lib/social-server";

export async function GET(request: Request) {
  return socialRoute(request, () => lookupPlayerNames(new URL(request.url).searchParams.get("ids") ?? ""));
}
