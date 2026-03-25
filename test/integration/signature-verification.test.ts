import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { SlackHonoApp, slackVerify } from "../../src/index";
import * as fixtures from "../fixtures";
import { buildSlackRequest } from "../helpers";

describe("signature verification", () => {
  it("rejects requests with invalid signature", async () => {
    const app = new SlackHonoApp({
      env: {
        SLACK_SIGNING_SECRET: fixtures.SIGNING_SECRET,
        SLACK_BOT_TOKEN: fixtures.BOT_TOKEN,
        SLACK_LOGGING_LEVEL: "ERROR",
      },
      authorize: fixtures.mockAuthorize,
    });
    app.command("/hello", async () => "ok");

    const hono = new Hono();
    hono.route("/", app.handler());

    // Sign with wrong secret
    const req = await buildSlackRequest({
      signingSecret: "wrong-secret",
      body: fixtures.slashCommand,
      contentType: "urlencoded",
    });

    const res = await hono.request(req);
    expect(res.status).toBe(401);
  });

  it("rejects requests with missing signature headers", async () => {
    const app = new SlackHonoApp({
      env: {
        SLACK_SIGNING_SECRET: fixtures.SIGNING_SECRET,
        SLACK_BOT_TOKEN: fixtures.BOT_TOKEN,
        SLACK_LOGGING_LEVEL: "ERROR",
      },
      authorize: fixtures.mockAuthorize,
    });

    const hono = new Hono();
    hono.route("/", app.handler());

    const req = new Request("http://localhost/slack/events", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "command=%2Fhello&text=world",
    });

    const res = await hono.request(req);
    expect(res.status).toBe(401);
  });

  it("slackVerify middleware rejects invalid signatures", async () => {
    const hono = new Hono();
    hono.post("/test", slackVerify(fixtures.SIGNING_SECRET), (c) => c.text("ok"));

    const req = new Request("http://localhost/test", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-slack-request-timestamp": Math.floor(Date.now() / 1000).toString(),
        "x-slack-signature": "v0=invalid",
      },
      body: "{}",
    });

    const res = await hono.request(req);
    expect(res.status).toBe(401);
  });

  it("slackVerify middleware passes valid signatures", async () => {
    const hono = new Hono();
    hono.post("/test", slackVerify(fixtures.SIGNING_SECRET), (c) => {
      return c.text(`raw:${c.var.slackRawBody}`);
    });

    const req = await buildSlackRequest({
      signingSecret: fixtures.SIGNING_SECRET,
      body: { test: true },
      contentType: "json",
      path: "/test",
    });

    const res = await hono.request(req);
    expect(res.status).toBe(200);

    const body = await res.text();
    expect(body).toContain("raw:");
    expect(body).toContain('"test":true');
  });
});
