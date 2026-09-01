import { createMiddleware } from "hono/factory";
import type { Authorize, AuthorizeResult, SlackAppEnv } from "slack-edge";
import { builtBaseContext } from "slack-edge";
import type { SlackHonoEnv } from "./types";

export type SlackAuthorizeEnv = {
  Variables: {
    slackAuth: AuthorizeResult;
    slackRawBody: string;
  };
};

export interface SlackAuthorizeOptions<E extends SlackAppEnv = SlackAppEnv> {
  authorize: Authorize<E>;
  /**
   * The app environment handed to the authorize callback as `req.env`, mirroring
   * what `SlackApp` passes internally. Authorize functions that resolve credentials
   * from the environment — including the default `singleTeamAuthorize`, which reads
   * `SLACK_BOT_TOKEN` — need this to be populated.
   *
   * Defaults to the Hono runtime bindings (`c.env`), which is where those secrets
   * live on Cloudflare Workers and other edge runtimes.
   */
  env?: E;
}

/**
 * Hono middleware that runs Slack authorization and stores the result
 * in `c.var.slackAuth`. Requires `slackVerify()` upstream (needs `slackRawBody`).
 *
 * @example
 * ```ts
 * app.post('/slack/events',
 *   slackVerify(signingSecret),
 *   // `singleTeamAuthorize` reads SLACK_BOT_TOKEN from the env; on Cloudflare
 *   // Workers the Hono bindings supply it, so `env` can be omitted.
 *   slackAuthorize({ authorize: singleTeamAuthorize, env: { SLACK_BOT_TOKEN: botToken } }),
 *   (c) => {
 *     const auth = c.var.slackAuth;
 *     // auth.botToken, auth.botId, etc.
 *   }
 * )
 * ```
 */
export const slackAuthorize = <E extends SlackAppEnv = SlackAppEnv>(options: SlackAuthorizeOptions<E>) =>
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

    // Fall back to the runtime bindings so env-reading authorize functions
    // (e.g. singleTeamAuthorize) work without extra wiring on edge runtimes.
    const env = options.env ?? ((c.env ?? {}) as E);

    let result: AuthorizeResult;
    try {
      result = await options.authorize({
        env,
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
