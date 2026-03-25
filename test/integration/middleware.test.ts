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

describe("slack-edge middleware", () => {
  it("beforeAuthorize can short-circuit", async () => {
    const app = createApp();
    const commandSpy = vi.fn(async () => "should not reach");

    app.beforeAuthorize(async (req) => {
      // Short-circuit by returning a response body
      const body = req.body as Record<string, string>;
      if (body.command === "/hello") {
        return { status: 200, body: "blocked by beforeAuthorize" };
      }
    });
    app.command("/hello", commandSpy);

    const ctx = new SpyExecutionContext();
    const req = await buildSlackRequest({
      signingSecret: fixtures.SIGNING_SECRET,
      body: fixtures.slashCommand,
      contentType: "urlencoded",
    });

    const res = await app.run(req, ctx);
    expect(res.status).toBe(200);

    const body = await res.text();
    expect(body).toContain("blocked by beforeAuthorize");
    expect(commandSpy).not.toHaveBeenCalled();
  });

  it("afterAuthorize runs before handlers", async () => {
    const app = createApp();
    const order: string[] = [];

    app.afterAuthorize(async (_req) => {
      order.push("middleware");
    });
    app.command("/hello", async () => {
      order.push("handler");
      return "ok";
    });

    const ctx = new SpyExecutionContext();
    const req = await buildSlackRequest({
      signingSecret: fixtures.SIGNING_SECRET,
      body: fixtures.slashCommand,
      contentType: "urlencoded",
    });

    await app.run(req, ctx);
    expect(order).toEqual(["middleware", "handler"]);
  });
});
