import { Hono } from "hono";
import type { InstallationStore, SlackOAuthEnv } from "slack-edge";
import { describe, expect, it } from "vitest";
import { SlackHonoOAuthApp } from "../../src/index";
import * as fixtures from "../fixtures";
import { buildSlackRequest } from "../helpers";

const mockInstallationStore: InstallationStore<SlackOAuthEnv> = {
  save: async () => {},
  findBotInstallation: async () => undefined,
  findUserInstallation: async () => undefined,
  deleteBotInstallation: async () => {},
  deleteUserInstallation: async () => {},
  deleteAll: async () => {},
  toAuthorize: () => async () => ({
    botId: "B0001",
    botUserId: "U0001",
    botToken: "xoxb-test",
    botScopes: ["commands"],
  }),
};

function createOAuthEnv(): SlackOAuthEnv {
  return {
    SLACK_SIGNING_SECRET: fixtures.SIGNING_SECRET,
    SLACK_BOT_TOKEN: fixtures.BOT_TOKEN,
    SLACK_CLIENT_ID: "test-client-id",
    SLACK_CLIENT_SECRET: "test-client-secret",
    SLACK_BOT_SCOPES: "commands,chat:write",
  };
}

describe("SlackHonoOAuthApp", () => {
  it("uses default route paths", () => {
    const app = new SlackHonoOAuthApp({
      env: createOAuthEnv(),
      installationStore: mockInstallationStore,
    });

    expect(app.routes.events).toBe("/slack/events");
    expect(app.routes.oauth.start).toBe("/slack/install");
    expect(app.routes.oauth.callback).toBe("/slack/oauth_redirect");
  });

  it("accepts custom route paths", () => {
    const app = new SlackHonoOAuthApp({
      env: createOAuthEnv(),
      installationStore: mockInstallationStore,
      routes: {
        events: "/api/events",
        oauth: { start: "/api/install", callback: "/api/callback" },
      },
    });

    expect(app.routes.events).toBe("/api/events");
    expect(app.routes.oauth.start).toBe("/api/install");
    expect(app.routes.oauth.callback).toBe("/api/callback");
  });

  it("handler() returns 404 for unregistered paths", async () => {
    const app = new SlackHonoOAuthApp({
      env: createOAuthEnv(),
      installationStore: mockInstallationStore,
    });

    const hono = new Hono();
    hono.route("/", app.handler());

    const res = await hono.request(new Request("http://localhost/wrong/path", { method: "POST" }));
    expect(res.status).toBe(404);
  });

  it("handler() registers GET route for OAuth start", async () => {
    const app = new SlackHonoOAuthApp({
      env: createOAuthEnv(),
      installationStore: mockInstallationStore,
    });

    const hono = new Hono();
    hono.route("/", app.handler());

    // OAuth start should respond (not 404) — it will redirect or show install page
    const res = await hono.request(new Request("http://localhost/slack/install"));
    expect(res.status).not.toBe(404);
  });

  it("handler() registers GET route for OAuth callback", async () => {
    const app = new SlackHonoOAuthApp({
      env: createOAuthEnv(),
      installationStore: mockInstallationStore,
    });

    const hono = new Hono();
    hono.route("/", app.handler());

    // OAuth callback should respond (not 404) — it will fail gracefully without valid state
    const res = await hono.request(new Request("http://localhost/slack/oauth_redirect?code=test&state=test"));
    expect(res.status).not.toBe(404);
  });

  it("handler() routes POST events through the OAuth app", async () => {
    const app = new SlackHonoOAuthApp({
      env: createOAuthEnv(),
      installationStore: mockInstallationStore,
    });

    const hono = new Hono();
    hono.route("/", app.handler());

    const req = await buildSlackRequest({
      signingSecret: fixtures.SIGNING_SECRET,
      body: fixtures.urlVerificationEvent,
      contentType: "json",
    });

    const res = await hono.request(req);
    expect(res.status).toBe(200);

    const body = await res.text();
    expect(body).toBe("test-challenge-string");
  });

  it("handler() registers OIDC routes when configured", async () => {
    const app = new SlackHonoOAuthApp({
      env: createOAuthEnv(),
      installationStore: mockInstallationStore,
      oidc: {
        callback: async () => new Response("ok"),
      },
      routes: {
        oidc: { start: "/slack/oidc/login", callback: "/slack/oidc/callback" },
      },
    });

    const hono = new Hono();
    hono.route("/", app.handler());

    const startRes = await hono.request(new Request("http://localhost/slack/oidc/login"));
    expect(startRes.status).not.toBe(404);

    const callbackRes = await hono.request(new Request("http://localhost/slack/oidc/callback?code=test&state=test"));
    expect(callbackRes.status).not.toBe(404);
  });
});
