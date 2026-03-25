# Approach C: Hono-Native Rewrite

## Context

Approach B (current) wraps slack-edge as a Hono sub-app — `SlackHonoApp` extends `SlackApp` and delegates all dispatch to slack-edge's `run()` method. This works but has limitations:

- **Opaque routing** — Slack event dispatch happens inside slack-edge, invisible to Hono's middleware stack
- **No per-route middleware** — can't apply Hono middleware to individual Slack handlers (e.g., rate limiting on a specific command)
- **Dual context** — handler authors use slack-edge's `context` object, not Hono's `c.var`, so the two worlds don't compose
- **Full slack-edge dependency** — shipping the entire framework when we only need pieces of it

Approach C replaces slack-edge's dispatch loop with native Hono routing, making each Slack interaction type a proper Hono route/middleware.

## What carries forward from Approach B (~60-70%)

- `slackVerify()` middleware — already standalone Hono middleware, no changes needed
- `slackAuthorize()` middleware — already standalone, no changes needed
- Test suite — 50 behavioral tests become the migration contract
- Test helpers — request factory, SpyExecutionContext, fixtures
- Type definitions — `SlackHonoEnv`, `SlackAuthorizeEnv`
- CI/CD, publish workflow, dependabot, lefthook

## What gets replaced

### 1. Request body parsing middleware

Replace slack-edge's internal body parsing with a Hono middleware that parses the Slack payload and sets it on context:

```ts
const slackParse = () => createMiddleware(async (c, next) => {
  const rawBody = c.var.slackRawBody;
  const contentType = c.req.header('content-type') ?? '';

  let body: SlackRequestBody;
  if (contentType.includes('application/json')) {
    body = JSON.parse(rawBody);
  } else {
    const params = new URLSearchParams(rawBody);
    const payload = params.get('payload');
    body = payload ? JSON.parse(payload) : Object.fromEntries(params);
  }

  c.set('slackBody', body);
  c.set('slackPayloadType', detectPayloadType(body));
  await next();
});
```

### 2. Native Hono dispatch

Instead of `SlackApp.run()`, route by payload type using Hono's native routing:

```ts
const slack = new Hono<SlackHonoEnv>();

slack.use('*', slackVerify(signingSecret));
slack.use('*', slackParse());
slack.use('*', slackAuthorize({ authorize }));

// URL verification (no auth needed — override above)
slack.post('*', urlVerification());

// Each interaction type is a middleware that checks payload type
slack.post('*', slackCommands({
  '/hello': { ack: helloAck, lazy: helloLazy },
  '/echo': { ack: echoAck },
}));

slack.post('*', slackEvents({
  'app_mention': mentionHandler,
  'message': messageHandler,
}));

slack.post('*', slackActions({
  'approve_button': { ack: approveAck, lazy: approveLazy },
}));

slack.post('*', slackViewSubmissions({
  'feedback_modal': { ack: feedbackAck, lazy: feedbackLazy },
}));
```

### 3. Ack/lazy split via `waitUntil`

Reimplement the ack/lazy pattern:

```ts
function slackCommands(handlers) {
  return createMiddleware(async (c) => {
    const body = c.var.slackBody;
    if (!body.command) return; // not a command, skip

    const handler = matchHandler(handlers, body.command);
    if (!handler) return c.text('No listener found', 404);

    const ackResult = await handler.ack(buildSlackRequest(c));

    if (handler.lazy) {
      const ctx = getExecutionContext(c);
      ctx.waitUntil(handler.lazy(buildSlackRequest(c)));
    }

    return formatAckResponse(c, ackResult);
  });
}
```

### 4. Context bridge

Expose Slack context on Hono's `c.var` so middleware composes naturally:

```ts
type SlackHonoEnv = {
  Variables: {
    slackRawBody: string;
    slackAuth: AuthorizeResult;
    slackBody: SlackRequestBody;
    slackPayloadType: 'command' | 'event' | 'action' | 'view_submission' | ...;
    slackClient: SlackAPIClient;
    slackSay: (params) => Promise<any>;  // when channelId is available
    slackRespond: (params) => Promise<any>;  // when response_url is available
  };
};
```

### 5. Drop slack-edge dependency

Replace with direct imports of the slim packages:
- `slack-web-api-client` — for `SlackAPIClient` (already a separate package)
- Keep `verifySlackRequest` — either vendor the function (it's ~15 lines) or keep slack-edge as optional

## Phases

### Phase C.1: Extract dispatch logic
- Implement `detectPayloadType()`, `matchHandler()`, `formatAckResponse()`
- Port the matching logic from slack-edge's `app.ts` (string/regex matching for commands, actions, views, etc.)
- Tests: existing behavioral tests must pass

### Phase C.2: Implement native middleware handlers
- `slackCommands()`, `slackEvents()`, `slackActions()`, `slackViewSubmissions()`, `slackShortcuts()`, `slackOptions()`
- Each is a standalone Hono middleware
- Tests: same behavioral tests, adapted to use Hono's test client

### Phase C.3: Context bridge
- Populate `c.var.slackClient`, `c.var.slackSay`, `c.var.slackRespond`
- Users can now use Hono middleware with full Slack context

### Phase C.4: Builder API (optional)
- Fluent API that feels like slack-edge but builds Hono middleware:

```ts
const slack = slackApp({ signingSecret, authorize })
  .command('/hello', helloAck, helloLazy)
  .event('app_mention', mentionHandler)
  .action('approve_button', approveAck, approveLazy)
  .build();  // returns Hono instance

app.route('/slack/events', slack);
```

### Phase C.5: Drop slack-edge
- Replace `slack-edge` dependency with `slack-web-api-client`
- Vendor or rewrite `verifySlackRequest` (15 lines of HMAC-SHA256)
- Update package.json, reduce bundle size

## Risks

- **Payload type detection** — slack-edge has years of edge cases handled in its dispatch. Reimplementing means risking regressions.
- **Type safety** — slack-edge's handler types are complex (generics for payload types, typed actions). Rebuilding those is significant work.
- **Maintenance burden** — owning the dispatch means owning Slack API changes. Currently slack-edge absorbs those.

## Decision criteria

Move to Approach C when:
- Hono middleware composition is a real user need (not theoretical)
- slack-edge's dispatch is limiting (can't handle a payload type, performance issue)
- The library has users who need the flexibility

Don't move just because it's "cleaner" — Approach B works and is easier to maintain.
