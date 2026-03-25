import { Hono } from "hono";
import type { ExecutionContext, SlackOAuthAppOptions, SlackOAuthEnv } from "slack-edge";
import { NoopExecutionContext, SlackOAuthApp } from "slack-edge";
import type { SlackHonoEnv } from "./types";

export interface SlackHonoOAuthAppOptions<E extends SlackOAuthEnv> extends Omit<SlackOAuthAppOptions<E>, "routes"> {
  routes?: {
    events?: string;
    oauth?: {
      start?: string;
      callback?: string;
    };
    oidc?: {
      start: string;
      callback: string;
    };
  };
}

/**
 * Wraps a slack-edge SlackOAuthApp as a Hono sub-app.
 * Handles event routes + OAuth install/callback routes.
 */
export class SlackHonoOAuthApp<E extends SlackOAuthEnv = SlackOAuthEnv> extends SlackOAuthApp<E> {
  private readonly honoPaths: {
    events: string;
    oauth: { start: string; callback: string };
    oidc?: { start: string; callback: string };
  };

  constructor(options: SlackHonoOAuthAppOptions<E>) {
    const events = options.routes?.events ?? "/slack/events";
    const oauthStart = options.routes?.oauth?.start ?? "/slack/install";
    const oauthCallback = options.routes?.oauth?.callback ?? "/slack/oauth_redirect";
    const oidc = options.routes?.oidc;

    super({
      ...options,
      routes: {
        events,
        oauth: { start: oauthStart, callback: oauthCallback },
        ...(oidc ? { oidc } : {}),
      },
    });

    this.honoPaths = {
      events,
      oauth: { start: oauthStart, callback: oauthCallback },
      oidc,
    };
  }

  handler(): Hono<SlackHonoEnv> {
    const hono = new Hono<SlackHonoEnv>();

    hono.post(this.honoPaths.events, async (c) => {
      let ctx: ExecutionContext;
      try {
        ctx = c.executionCtx;
      } catch {
        ctx = new NoopExecutionContext();
      }
      return await this.run(c.req.raw, ctx);
    });

    hono.get(this.honoPaths.oauth.start, async (c) => {
      return await this.handleOAuthStartRequest(c.req.raw);
    });

    hono.get(this.honoPaths.oauth.callback, async (c) => {
      return await this.handleOAuthCallbackRequest(c.req.raw);
    });

    if (this.honoPaths.oidc) {
      const oidcPaths = this.honoPaths.oidc;
      hono.get(oidcPaths.start, async (c) => {
        return await this.handleOIDCStartRequest(c.req.raw);
      });
      hono.get(oidcPaths.callback, async (c) => {
        return await this.handleOIDCCallbackRequest(c.req.raw);
      });
    }

    return hono;
  }
}
