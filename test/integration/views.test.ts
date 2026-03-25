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

describe("views", () => {
  it("handles view submission with ack", async () => {
    const app = createApp();
    const lazySpy = vi.fn(async () => {});

    app.viewSubmission("test_view", async () => ({}), lazySpy);

    const ctx = new SpyExecutionContext();
    const req = await buildInteractivityRequest(fixtures.SIGNING_SECRET, fixtures.viewSubmission);

    const res = await app.run(req, ctx);
    expect(res.status).toBe(200);

    await ctx.flush();
    expect(lazySpy).toHaveBeenCalled();
  });

  it("handles view submission with response_action", async () => {
    const app = createApp();

    app.viewSubmission("test_view", async () => ({
      response_action: "errors",
      errors: { title_input: "Title is required" },
    }));

    const ctx = new SpyExecutionContext();
    const req = await buildInteractivityRequest(fixtures.SIGNING_SECRET, fixtures.viewSubmission);

    const res = await app.run(req, ctx);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.response_action).toBe("errors");
    expect(body.errors.title_input).toBe("Title is required");
  });

  it("handles view closed", async () => {
    const app = createApp();
    const lazySpy = vi.fn(async () => {});

    app.viewClosed("test_view", async () => {}, lazySpy);

    const ctx = new SpyExecutionContext();
    const req = await buildInteractivityRequest(fixtures.SIGNING_SECRET, fixtures.viewClosed);

    const res = await app.run(req, ctx);
    expect(res.status).toBe(200);

    await ctx.flush();
    expect(lazySpy).toHaveBeenCalled();
  });
});
