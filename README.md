<p align="center">
  <img src="assets/logo.png" alt="slack-hono logo" width="200" />
</p>

# slack-hono

[![CI](https://github.com/TightknitAI/slack-hono/actions/workflows/ci.yml/badge.svg)](https://github.com/TightknitAI/slack-hono/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/slack-hono.svg)](https://www.npmjs.com/package/slack-hono)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Slack app framework as a [Hono](https://hono.dev) plugin — powered by [slack-edge](https://github.com/slack-edge/slack-edge).

Build Slack apps that run on Cloudflare Workers, Deno, Bun, Vercel Edge, and any other edge runtime, using Hono's middleware and routing.

## Install

```bash
pnpm add slack-hono hono
```

## Quick Start

```ts
import { Hono } from "hono";
import { SlackHonoApp } from "slack-hono";

const slack = new SlackHonoApp({
  env: {
    SLACK_SIGNING_SECRET: "your-signing-secret",
    SLACK_BOT_TOKEN: "xoxb-your-bot-token",
  },
});

slack.command("/hello", async () => "Hello from slack-hono!");

slack.event("app_mention", async ({ context, payload }) => {
  await context.say({ text: `You said: ${payload.text}` });
});

const app = new Hono();
app.route("/", slack.handler());

export default app;
```

## Before / After

### Before (raw slack-edge + Hono glue)

```ts
import { Hono } from "hono";
import { SlackApp } from "slack-edge";

const slackApp = new SlackApp({
  env: {
    SLACK_SIGNING_SECRET: signingSecret,
    SLACK_BOT_TOKEN: botToken,
  },
  routes: { events: "/slack/events" },
});

slackApp.command("/hello", async () => "Hello!");

const app = new Hono();
app.post("/slack/events", async (c) => {
  // Manual glue: pass raw request + execution context
  let ctx;
  try { ctx = c.executionCtx; } catch { ctx = { waitUntil() {} }; }
  return await slackApp.run(c.req.raw, ctx);
});

export default app;
```

### After (slack-hono)

```ts
import { Hono } from "hono";
import { SlackHonoApp } from "slack-hono";

const slack = new SlackHonoApp({
  env: {
    SLACK_SIGNING_SECRET: signingSecret,
    SLACK_BOT_TOKEN: botToken,
  },
});

slack.command("/hello", async () => "Hello!");

const app = new Hono();
app.route("/", slack.handler());

export default app;
```

## API

### `SlackHonoApp`

Extends `SlackApp` from slack-edge. Adds a `handler()` method that returns a Hono sub-app.

```ts
const slack = new SlackHonoApp({
  env: {
    SLACK_SIGNING_SECRET: "...",
    SLACK_BOT_TOKEN: "...",
  },
  // Optional: custom authorize function (default: singleTeamAuthorize)
  authorize: myAuthorize,
  // Optional: custom event path (default: "/slack/events")
  path: "/slack/events",
});
```

All slack-edge listener methods are available:

```ts
// Slash commands
slack.command("/hello", ackHandler, lazyHandler);

// Events API
slack.event("app_mention", lazyHandler);
slack.event("message", lazyHandler);
slack.anyMessage(lazyHandler);
slack.message("pattern", lazyHandler);

// Block actions
slack.action("action_id", ackHandler, lazyHandler);
slack.action(/regex/, ackHandler, lazyHandler);
slack.action({ type: "button", action_id: "id" }, ackHandler, lazyHandler);

// Block suggestions
slack.options("action_id", ackHandler);

// Shortcuts
slack.globalShortcut("callback_id", ackHandler, lazyHandler);
slack.messageShortcut("callback_id", ackHandler, lazyHandler);

// Views
slack.viewSubmission("callback_id", ackHandler, lazyHandler);
slack.viewClosed("callback_id", ackHandler, lazyHandler);

// Middleware
slack.beforeAuthorize(middleware);
slack.afterAuthorize(middleware);
```

### `SlackHonoOAuthApp`

For multi-workspace apps that need OAuth installation flow:

```ts
import { SlackHonoOAuthApp } from "slack-hono";

const slack = new SlackHonoOAuthApp({
  env: {
    SLACK_SIGNING_SECRET: "...",
    SLACK_CLIENT_ID: "...",
    SLACK_CLIENT_SECRET: "...",
    SLACK_BOT_SCOPES: "commands,chat:write",
  },
  installationStore: myInstallationStore,
  routes: {
    events: "/slack/events",          // default
    oauth: {
      start: "/slack/install",        // default
      callback: "/slack/oauth_redirect", // default
    },
  },
});

const app = new Hono();
app.route("/", slack.handler());
```

### `slackVerify()`

Standalone Hono middleware for Slack request signature verification. Useful when building custom handlers outside of `SlackHonoApp`:

```ts
import { slackVerify } from "slack-hono";

app.post("/webhook", slackVerify(signingSecret), (c) => {
  const rawBody = c.var.slackRawBody;
  // ... handle verified request
});
```

### `slackAuthorize()`

Standalone Hono middleware for Slack authorization. Must be used after `slackVerify()`:

```ts
import { slackVerify, slackAuthorize, singleTeamAuthorize } from "slack-hono";

app.post(
  "/slack/events",
  slackVerify(signingSecret),
  slackAuthorize({ authorize: singleTeamAuthorize }),
  (c) => {
    const auth = c.var.slackAuth;
    // auth.botToken, auth.botId, auth.botUserId, etc.
  }
);
```

### Type Definitions

```ts
import type { SlackHonoEnv, SlackContext } from "slack-hono";

// SlackHonoEnv provides typed Hono variables:
// c.var.slack       — SlackContext (client, botToken, authorizeResult, etc.)
// c.var.slackRawBody — string (raw request body)
// c.var.slackAuth   — AuthorizeResult (from slackAuthorize middleware)
```

## Deployment

### Cloudflare Workers

```ts
import { Hono } from "hono";
import { SlackHonoApp } from "slack-hono";

type Env = { SLACK_SIGNING_SECRET: string; SLACK_BOT_TOKEN: string };

const app = new Hono<{ Bindings: Env }>();

app.post("/slack/events", async (c) => {
  const slack = new SlackHonoApp({
    env: {
      SLACK_SIGNING_SECRET: c.env.SLACK_SIGNING_SECRET,
      SLACK_BOT_TOKEN: c.env.SLACK_BOT_TOKEN,
    },
  });
  slack.command("/hello", async () => "Hello from Workers!");
  return await slack.run(c.req.raw, c.executionCtx);
});

export default app;
```

### Cloudflare Workers with OAuth (multi-workspace)

For apps installed across multiple workspaces, use [`slack-cloudflare-workers`](https://github.com/slack-edge/slack-cloudflare-workers) for KV-backed installation and state stores:

```bash
pnpm add slack-hono slack-cloudflare-workers hono
```

```ts
import { Hono } from "hono";
import { SlackHonoOAuthApp } from "slack-hono";
import { KVInstallationStore, KVStateStore } from "slack-cloudflare-workers";

type Env = {
  Bindings: {
    SLACK_SIGNING_SECRET: string;
    SLACK_CLIENT_ID: string;
    SLACK_CLIENT_SECRET: string;
    SLACK_BOT_SCOPES: string;
    SLACK_INSTALLATIONS: KVNamespace;
    SLACK_OAUTH_STATE: KVNamespace;
  };
};

const app = new Hono<Env>();

app.all("/slack/*", async (c) => {
  const slack = new SlackHonoOAuthApp({
    env: c.env,
    installationStore: new KVInstallationStore(c.env, c.env.SLACK_INSTALLATIONS),
    stateStore: new KVStateStore(c.env.SLACK_OAUTH_STATE),
  });

  slack.command("/hello", async () => "Hello from a multi-workspace app!");

  return await slack.run(c.req.raw, c.executionCtx);
});

export default app;
```

## Acknowledgements

Built on top of [slack-edge](https://github.com/slack-edge/slack-edge) by [@seratch](https://github.com/seratch) — a fantastic Slack app framework for edge runtimes. slack-hono wouldn't exist without it.

## License

MIT

---

Maintained by the [Tightknit](https://tightknit.ai) team.
