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

describe("Events API", () => {
  it("responds to url_verification challenge", async () => {
    const app = createApp();
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

  it("handles app_mention event", async () => {
    const app = createApp();
    const lazySpy = vi.fn(async () => {});

    app.event("app_mention", lazySpy);

    const ctx = new SpyExecutionContext();
    const req = await buildSlackRequest({
      signingSecret: fixtures.SIGNING_SECRET,
      body: fixtures.appMentionEvent,
      contentType: "json",
    });

    const res = await app.run(req, ctx);
    expect(res.status).toBe(200);

    await ctx.flush();
    expect(lazySpy).toHaveBeenCalled();
  });

  it("handles message event via anyMessage()", async () => {
    const app = createApp();
    const lazySpy = vi.fn(async () => {});

    app.anyMessage(lazySpy);

    const ctx = new SpyExecutionContext();
    const req = await buildSlackRequest({
      signingSecret: fixtures.SIGNING_SECRET,
      body: fixtures.messageEvent,
      contentType: "json",
    });

    const res = await app.run(req, ctx);
    expect(res.status).toBe(200);

    await ctx.flush();
    expect(lazySpy).toHaveBeenCalled();
  });

  it("handles message event via message() with pattern", async () => {
    const app = createApp();
    const lazySpy = vi.fn(async () => {});

    app.message("hello", lazySpy);

    const ctx = new SpyExecutionContext();
    const req = await buildSlackRequest({
      signingSecret: fixtures.SIGNING_SECRET,
      body: fixtures.messageEvent,
      contentType: "json",
    });

    const res = await app.run(req, ctx);
    expect(res.status).toBe(200);

    await ctx.flush();
    expect(lazySpy).toHaveBeenCalled();
  });
});
