import { describe, expect, it, vi } from "vitest";
import { SlackHonoApp } from "../../src/index";
import * as fixtures from "../fixtures";
import { buildInteractivityRequest, SpyExecutionContext } from "../helpers";

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

describe("shortcuts", () => {
  it("handles global shortcut", async () => {
    const app = createApp();
    const lazySpy = vi.fn(async () => {});

    app.globalShortcut("test_global_shortcut", async () => {}, lazySpy);

    const ctx = new SpyExecutionContext();
    const req = await buildInteractivityRequest(fixtures.SIGNING_SECRET, fixtures.globalShortcut);

    const res = await app.run(req, ctx);
    expect(res.status).toBe(200);

    await ctx.flush();
    expect(lazySpy).toHaveBeenCalled();
  });

  it("handles message shortcut", async () => {
    const app = createApp();
    const lazySpy = vi.fn(async () => {});

    app.messageShortcut("test_message_shortcut", async () => {}, lazySpy);

    const ctx = new SpyExecutionContext();
    const req = await buildInteractivityRequest(fixtures.SIGNING_SECRET, fixtures.messageShortcut);

    const res = await app.run(req, ctx);
    expect(res.status).toBe(200);

    await ctx.flush();
    expect(lazySpy).toHaveBeenCalled();
  });
});
