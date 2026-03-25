import { Hono } from "hono";
import type { ExecutionContext, SlackAppOptions, SlackEdgeAppEnv } from "slack-edge";
import { NoopExecutionContext, SlackApp } from "slack-edge";
import type { SlackHonoEnv } from "./types";

export interface SlackHonoAppOptions<E extends SlackEdgeAppEnv> extends Omit<SlackAppOptions<E>, "routes"> {
  /**
   * The Hono route path for Slack events. Defaults to "/slack/events".
   */
  path?: string;
}

/**
 * Wraps a slack-edge SlackApp as a Hono sub-app.
 * Delegates all listener registration and dispatch to slack-edge,
 * but exposes a Hono-compatible interface.
 */
export class SlackHonoApp<E extends SlackEdgeAppEnv = SlackEdgeAppEnv> extends SlackApp<E> {
  readonly honoPath: string;

  constructor(options: SlackHonoAppOptions<E>) {
    const path = options.path ?? "/slack/events";
    super({ ...options, routes: { events: path } });
    this.honoPath = path;
  }

  /**
   * Returns a Hono app that handles Slack requests.
   * Mount this on your Hono app: `app.route('/', slackApp.handler())`
   */
  handler(): Hono<SlackHonoEnv> {
    const hono = new Hono<SlackHonoEnv>();

    hono.post(this.honoPath, async (c) => {
      let ctx: ExecutionContext;
      try {
        ctx = c.executionCtx;
      } catch {
        ctx = new NoopExecutionContext();
      }
      const response = await this.run(c.req.raw, ctx);
      return response;
    });

    return hono;
  }
}
