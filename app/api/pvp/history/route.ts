import { getPvpHistory } from "@/lib/pvp-server";
import { socialRoute } from "@/lib/social-server";

export async function GET(request: Request) {
  return socialRoute(request, getPvpHistory);
}
