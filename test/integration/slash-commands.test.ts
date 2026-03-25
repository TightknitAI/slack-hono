import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { SlackHonoApp } from "../../src/index";
import * as fixtures from "../fixtures";
import { buildSlackRequest, SpyExecutionContext } from "../helpers";

function createApp() {
  return new SlackHonoApp({
    env: {
      SLACK_SIGNING_SECRET: fixtures.SIGNING_SECRET,
      SLACK_BOT_TOKEN: fixtures.BOT_TOKEN,
      SLACK_LOGGING_LEVEL: "ERROR",
    },
    authorize: fixtures.mockAuthorize,
  });
}

describe("slash commands", () => {
  it("acks a registered slash command", async () => {
    const app = createApp();
    const lazySpy = vi.fn(async () => {});

    app.command("/hello", async (_req) => "Hello, World!", lazySpy);

    const hono = new Hono();
    hono.route("/", app.handler());

    const req = await buildSlackRequest({
      signingSecret: fixtures.SIGNING_SECRET,
      body: fixtures.slashCommand,
      contentType: "urlencoded",
    });

    const res = await hono.request(req);
    expect(res.status).toBe(200);

    const body = await res.text();
    expect(body).toContain("Hello, World!");
  });

  it("fires lazy handler via waitUntil", async () => {
    const app = createApp();
    const lazySpy = vi.fn(async () => {});

    app.command("/hello", async () => "ack", lazySpy);

    const ctx = new SpyExecutionContext();
    const req = await buildSlackRequest({
      signingSecret: fixtures.SIGNING_SECRET,
      body: fixtures.slashCommand,
      contentType: "urlencoded",
    });

    const res = await app.run(req, ctx);
    expect(res.status).toBe(200);

    await ctx.flush();
    expect(lazySpy).toHaveBeenCalled();
  });

  it("returns 404 for unregistered commands", async () => {
    const app = createApp();
    app.command("/other", async () => "nope");

    const hono = new Hono();
    hono.route("/", app.handler());

    const req = await buildSlackRequest({
      signingSecret: fixtures.SIGNING_SECRET,
      body: { ...fixtures.slashCommand, command: "/unknown" },
      contentType: "urlencoded",
    });

    const res = await hono.request(req);
    // slack-edge returns 404 for unmatched commands
    expect(res.status).toBe(404);
  });
});
