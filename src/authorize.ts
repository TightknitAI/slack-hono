import { createMiddleware } from "hono/factory";
import type { Authorize, AuthorizeResult } from "slack-edge";
import { builtBaseContext } from "slack-edge";
import type { SlackHonoEnv } from "./types";

export type SlackAuthorizeEnv = {
  Variables: {
    slackAuth: AuthorizeResult;
    slackRawBody: string;
  };
};

export interface SlackAuthorizeOptions {
  authorize: Authorize;
}

/**
 * Hono middleware that runs Slack authorization and stores the result
 * in `c.var.slackAuth`. Requires `slackVerify()` upstream (needs `slackRawBody`).
 *
 * @example
 * ```ts
 * app.post('/slack/events',
 *   slackVerify(signingSecret),
 *   slackAuthorize({ authorize: singleTeamAuthorize }),
 *   (c) => {
 *     const auth = c.var.slackAuth;
 *     // auth.botToken, auth.botId, etc.
 *   }
 * )
 * ```
 */
export const slackAuthorize = (options: SlackAuthorizeOptions) =>
  createMiddleware<SlackHonoEnv & SlackAuthorizeEnv>(async (c, next) => {
    const rawBody = c.var.slackRawBody;
    if (!rawBody) {
      return c.text("Missing raw body — use slackVerify() before slackAuthorize()", 500);
    }

    let body: Record<string, unknown>;
    try {
      const contentType = c.req.header("content-type") ?? "";
      if (contentType.includes("application/json")) {
        body = JSON.parse(rawBody);
      } else {
        const params = new URLSearchParams(rawBody);
        const payloadStr = params.get("payload");
        if (payloadStr) {
          body = JSON.parse(payloadStr);
        } else {
          body = Object.fromEntries(params.entries());
        }
      }
    } catch {
      return c.text("Malformed request body", 400);
    }

    const context = builtBaseContext(body);

    let result: AuthorizeResult;
    try {
      result = await options.authorize({
        env: {} as Record<string, string>,
        context,
        body,
        rawBody,
        headers: c.req.raw.headers,
      });
    } catch {
      return c.text("Authorization failed", 401);
    }

    c.set("slackAuth", result);
    await next();
  });
