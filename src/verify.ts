import { createMiddleware } from "hono/factory";
import { verifySlackRequest } from "slack-edge";
import type { SlackHonoEnv } from "./types";

/**
 * Hono middleware that verifies Slack request signatures.
 * Stores the raw body in c.var.slackRawBody for downstream use.
 */
export const slackVerify = (signingSecret: string) =>
  createMiddleware<SlackHonoEnv>(async (c, next) => {
    const rawBody = await c.req.text();
    const valid = await verifySlackRequest(signingSecret, c.req.raw.headers, rawBody);
    if (!valid) {
      return c.text("Invalid signature", 401);
    }
    c.set("slackRawBody", rawBody);
    await next();
  });
