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

describe("block actions", () => {
  it("handles action by action_id string", async () => {
    const app = createApp();
    const lazySpy = vi.fn(async () => {});

    app.action("test_action", async () => {}, lazySpy);

    const ctx = new SpyExecutionContext();
    const req = await buildInteractivityRequest(fixtures.SIGNING_SECRET, fixtures.blockAction);

    const res = await app.run(req, ctx);
    expect(res.status).toBe(200);

    await ctx.flush();
    expect(lazySpy).toHaveBeenCalled();
  });

  it("handles action by regex pattern", async () => {
    const app = createApp();
    const lazySpy = vi.fn(async () => {});

    app.action(/test_.*/, async () => {}, lazySpy);

    const ctx = new SpyExecutionContext();
    const req = await buildInteractivityRequest(fixtures.SIGNING_SECRET, fixtures.blockAction);

    const res = await app.run(req, ctx);
    expect(res.status).toBe(200);

    await ctx.flush();
    expect(lazySpy).toHaveBeenCalled();
  });

  it("handles action by typed constraints", async () => {
    const app = createApp();
    const lazySpy = vi.fn(async () => {});

    app.action({ type: "button", action_id: "test_action", block_id: "test_block" }, async () => {}, lazySpy);

    const ctx = new SpyExecutionContext();
    const req = await buildInteractivityRequest(fixtures.SIGNING_SECRET, fixtures.blockAction);

    const res = await app.run(req, ctx);
    expect(res.status).toBe(200);

    await ctx.flush();
    expect(lazySpy).toHaveBeenCalled();
  });
});
