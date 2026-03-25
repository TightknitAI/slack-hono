import type { AuthorizeResult, Respond } from "slack-edge";
import type { SlackAPIClient } from "slack-web-api-client";

/**
 * Slack context object for use in custom Hono middleware.
 * This type is exported for users building their own middleware
 * that needs to pass Slack context through Hono's c.var.
 */
export type SlackContext = {
  client: SlackAPIClient;
  botToken: string;
  botId: string;
  botUserId: string;
  userToken?: string;
  authorizeResult: AuthorizeResult;
  respond?: Respond;
  say?: (params: Record<string, unknown>) => Promise<unknown>;
};

/**
 * Hono environment type for slack-hono middleware.
 * - `slackRawBody` is set by `slackVerify()`
 * - `slackAuth` is set by `slackAuthorize()`
 */
export type SlackHonoEnv = {
  Variables: {
    slackRawBody: string;
    slackAuth: AuthorizeResult;
  };
};
