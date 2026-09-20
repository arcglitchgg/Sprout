import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function load(name) {
  const source = readFileSync(name.replace("@/", "") + ".ts", "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
  const loaded = { exports: {} };
  new Function("require", "module", "exports", outputText)(load, loaded, loaded.exports);
  return loaded.exports;
}

const { authenticateDiscordActivity, isDiscordActivity } = load("@/lib/discord-client");

test("standalone URLs are rejected before SDK construction", () => {
  assert.equal(isDiscordActivity(""), false);
  assert.equal(isDiscordActivity("?frame_id=frame&instance_id=instance"), false);
  assert.equal(isDiscordActivity("?frame_id=frame&instance_id=instance&platform=desktop"), true);
});

test("Discord authentication performs ready, authorize, exchange, and authenticate in order", async () => {
  const calls = [];
  const sdk = {
    ready: async () => { calls.push("ready"); },
    commands: {
      authorize: async (args) => { calls.push(["authorize", args]); return { code: "code-1" }; },
      authenticate: async (args) => {
        calls.push(["authenticate", args]);
        return { user: { id: "user-1", username: "sprout-player", global_name: "Sprout Player", avatar: null } };
      },
    },
  };
  const user = await authenticateDiscordActivity({
    clientId: "client-1",
    sdk,
    onReady: () => calls.push("ready-state"),
    exchangeCode: async (code) => { calls.push(["exchange", code]); return "access-1"; },
  });
  assert.deepEqual(calls, [
    "ready",
    "ready-state",
    ["authorize", { client_id: "client-1", response_type: "code", prompt: "none", scope: ["identify"] }],
    ["exchange", "code-1"],
    ["authenticate", { access_token: "access-1" }],
  ]);
  assert.deepEqual(user, { id: "user-1", username: "sprout-player", globalName: "Sprout Player", avatar: null });
});

test("authentication failures reject without producing identity", async () => {
  const sdk = {
    ready: async () => {},
    commands: {
      authorize: async () => ({ code: "bad-code" }),
      authenticate: async () => null,
    },
  };
  await assert.rejects(() => authenticateDiscordActivity({ clientId: "client-1", sdk, exchangeCode: async () => "bad-token" }), /no user/i);
});

test("structured token exchange passes only the Discord access token to the SDK", async () => {
  let received;
  const sdk = {
    ready: async () => {},
    commands: {
      authorize: async () => ({ code: "code-1" }),
      authenticate: async (args) => { received = args; return { user: { id: "user-1", username: "sprout-player" } }; },
    },
  };
  await authenticateDiscordActivity({ clientId: "client-1", sdk, exchangeCode: async () => ({ accessToken: "access-1", session: "sprout-session" }) });
  assert.deepEqual(received, { access_token: "access-1" });
});
