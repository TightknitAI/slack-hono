import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import type { SlackAuthorizeEnv } from "../../src/authorize";
import type { SlackHonoEnv } from "../../src/index";
import { slackAuthorize, slackVerify } from "../../src/index";
import * as fixtures from "../fixtures";
import { buildSlackRequest } from "../helpers";

type Env = SlackHonoEnv & SlackAuthorizeEnv;

describe("slackAuthorize middleware", () => {
  it("sets slackAuth on context after authorization", async () => {
    const hono = new Hono<Env>();

    hono.post(
      "/slack/events",
      slackVerify(fixtures.SIGNING_SECRET),
      slackAuthorize({ authorize: fixtures.mockAuthorize }),
      (c) => {
        const auth = c.var.slackAuth;
        return c.json({
          botId: auth.botId,
          botUserId: auth.botUserId,
          teamId: auth.teamId,
        });
      },
    );

    const req = await buildSlackRequest({
      signingSecret: fixtures.SIGNING_SECRET,
      body: fixtures.slashCommand,
      contentType: "urlencoded",
      path: "/slack/events",
    });

    const res = await hono.request(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.botId).toBe(fixtures.BOT_ID);
    expect(body.botUserId).toBe(fixtures.BOT_USER_ID);
    expect(body.teamId).toBe(fixtures.TEAM_ID);
  });

  it("works with JSON event payloads", async () => {
    const hono = new Hono<Env>();

    hono.post(
      "/slack/events",
      slackVerify(fixtures.SIGNING_SECRET),
      slackAuthorize({ authorize: fixtures.mockAuthorize }),
      (c) => {
        const auth = c.var.slackAuth;
        return c.json({ botToken: auth.botToken });
      },
    );

    const req = await buildSlackRequest({
      signingSecret: fixtures.SIGNING_SECRET,
      body: fixtures.appMentionEvent,
      contentType: "json",
      path: "/slack/events",
    });

    const res = await hono.request(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.botToken).toBe(fixtures.BOT_TOKEN);
  });

  it("works with interactivity payloads (payload=JSON)", async () => {
    const hono = new Hono<Env>();

    hono.post(
      "/slack/events",
      slackVerify(fixtures.SIGNING_SECRET),
      slackAuthorize({ authorize: fixtures.mockAuthorize }),
      (c) => {
        const auth = c.var.slackAuth;
        return c.json({ botId: auth.botId });
      },
    );

    const req = await buildSlackRequest({
      signingSecret: fixtures.SIGNING_SECRET,
      body: { payload: fixtures.blockAction },
      contentType: "urlencoded",
      path: "/slack/events",
    });

    const res = await hono.request(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.botId).toBe(fixtures.BOT_ID);
  });

  it("returns 500 if slackVerify was not used upstream", async () => {
    const hono = new Hono<Env>();

    hono.post("/slack/events", slackAuthorize({ authorize: fixtures.mockAuthorize }), (c) =>
      c.text("should not reach"),
    );

    const req = await buildSlackRequest({
      signingSecret: fixtures.SIGNING_SECRET,
      body: fixtures.slashCommand,
      contentType: "urlencoded",
      path: "/slack/events",
    });

    const res = await hono.request(req);
    expect(res.status).toBe(500);
  });

  it("returns 401 when authorize function throws", async () => {
    const hono = new Hono<Env>();
    const failingAuthorize = async () => {
      throw new Error("Token revoked");
    };

    hono.post(
      "/slack/events",
      slackVerify(fixtures.SIGNING_SECRET),
      slackAuthorize({ authorize: failingAuthorize }),
      (c) => c.text("should not reach"),
    );

    const req = await buildSlackRequest({
      signingSecret: fixtures.SIGNING_SECRET,
      body: fixtures.slashCommand,
      contentType: "urlencoded",
      path: "/slack/events",
    });

    const res = await hono.request(req);
    expect(res.status).toBe(401);
    const body = await res.text();
    expect(body).toContain("Token revoked");
  });

  it("returns 400 on malformed JSON body", async () => {
    const hono = new Hono<Env>();

    // Use a custom middleware that sets slackRawBody to malformed content
    hono.post(
      "/slack/events",
      async (c, next) => {
        c.set("slackRawBody" as never, "payload=not-valid-json{{{" as never);
        await next();
      },
      slackAuthorize({ authorize: fixtures.mockAuthorize }),
      (c) => c.text("should not reach"),
    );

    const req = new Request("http://localhost/slack/events", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "payload=not-valid-json{{{",
    });

    const res = await hono.request(req);
    expect(res.status).toBe(400);
  });
});
