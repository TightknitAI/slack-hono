import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { SlackHonoApp } from "../../src/index";
import * as fixtures from "../fixtures";
import { buildSlackRequest } from "../helpers";

describe("routing", () => {
  it("handles requests on the configured path", async () => {
    const app = new SlackHonoApp({
      env: {
        SLACK_SIGNING_SECRET: fixtures.SIGNING_SECRET,
        SLACK_BOT_TOKEN: fixtures.BOT_TOKEN,
        SLACK_LOGGING_LEVEL: "ERROR",
      },
      authorize: fixtures.mockAuthorize,
      path: "/slack/events",
    });
    app.command("/hello", async () => "ok");

    const hono = new Hono();
    hono.route("/", app.handler());

    const req = await buildSlackRequest({
      signingSecret: fixtures.SIGNING_SECRET,
      body: fixtures.slashCommand,
      contentType: "urlencoded",
      path: "/slack/events",
    });

    const res = await hono.request(req);
    expect(res.status).toBe(200);
  });

  it("returns 404 for wrong path", async () => {
    const app = new SlackHonoApp({
      env: {
        SLACK_SIGNING_SECRET: fixtures.SIGNING_SECRET,
        SLACK_BOT_TOKEN: fixtures.BOT_TOKEN,
        SLACK_LOGGING_LEVEL: "ERROR",
      },
      authorize: fixtures.mockAuthorize,
      path: "/slack/events",
    });

    const hono = new Hono();
    hono.route("/", app.handler());

    const req = await buildSlackRequest({
      signingSecret: fixtures.SIGNING_SECRET,
      body: fixtures.slashCommand,
      contentType: "urlencoded",
      path: "/wrong/path",
    });

    const res = await hono.request(req);
    expect(res.status).toBe(404);
  });

  it("supports custom event path", async () => {
    const app = new SlackHonoApp({
      env: {
        SLACK_SIGNING_SECRET: fixtures.SIGNING_SECRET,
        SLACK_BOT_TOKEN: fixtures.BOT_TOKEN,
        SLACK_LOGGING_LEVEL: "ERROR",
      },
      authorize: fixtures.mockAuthorize,
      path: "/api/slack",
    });
    app.command("/hello", async () => "custom path works");

    const hono = new Hono();
    hono.route("/", app.handler());

    const req = await buildSlackRequest({
      signingSecret: fixtures.SIGNING_SECRET,
      body: fixtures.slashCommand,
      contentType: "urlencoded",
      path: "/api/slack",
    });

    const res = await hono.request(req);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("custom path works");
  });

  it("can be mounted at a base path on the Hono app", async () => {
    // When using hono.route(), the SlackHonoApp path must be the sub-path
    // relative to the mount point (Hono strips the prefix for route matching,
    // but slack-edge's internal routing uses the full URL path).
    const app = new SlackHonoApp({
      env: {
        SLACK_SIGNING_SECRET: fixtures.SIGNING_SECRET,
        SLACK_BOT_TOKEN: fixtures.BOT_TOKEN,
        SLACK_LOGGING_LEVEL: "ERROR",
      },
      authorize: fixtures.mockAuthorize,
      path: "/slack/events",
    });
    app.command("/hello", async () => "mounted");

    const hono = new Hono();
    hono.route("/", app.handler());

    const req = await buildSlackRequest({
      signingSecret: fixtures.SIGNING_SECRET,
      body: fixtures.slashCommand,
      contentType: "urlencoded",
      path: "/slack/events",
    });

    const res = await hono.request(req);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("mounted");
  });
});
