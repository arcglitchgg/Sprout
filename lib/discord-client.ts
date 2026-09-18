export type DiscordEnvironment = "discord" | "standalone";

export type BasicDiscordUser = {
  id: string;
  username: string;
  globalName: string | null;
  avatar: string | null;
};

type DiscordSdkLike = {
  ready: () => Promise<void>;
  commands: {
    authorize: (args: { client_id: string; response_type: "code"; prompt: "none"; scope: ["identify"] }) => Promise<{ code: string }>;
    authenticate: (args: { access_token: string }) => Promise<{ user: { id: string; username: string; global_name?: string | null; avatar?: string | null } } | null>;
  };
};

export function isDiscordActivity(search: string) {
  const params = new URLSearchParams(search);
  return Boolean(params.get("frame_id") && params.get("instance_id") && params.get("platform"));
}

export async function authenticateDiscordActivity({ clientId, sdk, exchangeCode, onReady }: {
  clientId: string;
  sdk: DiscordSdkLike;
  exchangeCode: (code: string) => Promise<string>;
  onReady?: () => void;
}): Promise<BasicDiscordUser> {
  await sdk.ready();
  onReady?.();
  const { code } = await sdk.commands.authorize({
    client_id: clientId,
    response_type: "code",
    prompt: "none",
    scope: ["identify"],
  });
  const accessToken = await exchangeCode(code);
  const auth = await sdk.commands.authenticate({ access_token: accessToken });
  if (!auth) throw new Error("Discord authentication returned no user.");
  return {
    id: auth.user.id,
    username: auth.user.username,
    globalName: auth.user.global_name ?? null,
    avatar: auth.user.avatar ?? null,
  };
}
