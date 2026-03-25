# slack-edge → slack-hono: Plan

## Context

slack-edge is a Slack app framework for edge runtimes. It uses standard Web `Request`/`Response` APIs. The goal is to convert it into a Hono plugin (`slack-hono`). Before any conversion work begins, we need a behavioral test suite against the current slack-edge to serve as a migration contract — the existing tests are mostly type-checking, not behavioral.

**Chosen approach**: B (Hono Middleware Wrapper) — wrap slack-edge as proper Hono middleware, extract verification/auth into composable Hono middleware, keep the proven dispatch logic. ~60-70% of this work carries forward if we later pursue a full Hono-native rewrite (Approach C).

**Repo**: `/Users/zhawtof/dev/slack-hono` — standalone repo, depends on `slack-edge` via npm.

---

## Phase 0: Project Bootstrap ✅

### 0.1 README-First API Design

Write `README.md` before any code. Include:
- The "before" (raw slack-edge + Hono glue) vs "after" (slack-hono) usage examples
- API surface for `slackVerify()`, `slackAuthorize()`, `SlackHonoApp`, OAuth routes
- Example for each listener type (command, event, action, shortcut, view)

This forces the API design to be settled before implementation. If the usage example feels awkward, the API is wrong.

### 0.2 Repo Setup

Create `/Users/zhawtof/dev/slack-hono`:
- `package.json` — name: `slack-hono`, peer deps: `hono`, deps: `slack-edge@1.3.15` (pinned)
- `tsconfig.json` — strict, ESM-only output
- `vitest.config.ts`
- `src/index.ts` — main export
- `LICENSE` — MIT (matching slack-edge)
- `.gitignore`

### 0.3 GitHub Actions CI

`.github/workflows/ci.yml`:
- Runs on push and PR
- `npm test` (Vitest — type tests + behavioral tests)
- `npm run typecheck` (tsc --noEmit)

### 0.4 Slack Test App

Set up a real Slack app in a test workspace with bot token + signing secret. Deploy a minimal slack-edge app and capture real payloads for each interaction type (command, event, action, shortcut, view submission, view closed, block suggestion). These become the golden test fixtures in `test/fixtures/`.

---

## Phase 1: Behavioral Test Suite (migration contract) ✅

The existing slack-edge tests verify types compile but don't send requests through `app.run()`. We need integration tests that become the **migration contract**: green on slack-edge → must stay green on slack-hono.

### 1.1 Request Fixture Factory

Build a helper that constructs properly signed Slack HTTP requests:

```ts
// test/helpers/slack-request-factory.ts
function buildSlackRequest(opts: {
  signingSecret: string
  body: Record<string, any>
  contentType?: 'json' | 'urlencoded'
  headers?: Record<string, string>
}): Request
```

- Computes `x-slack-signature` and `x-slack-request-timestamp` headers using the signing secret
- Supports both JSON bodies (Events API) and URL-encoded bodies (slash commands, interactivity payloads)
- Reference: slack-edge's `src/request/request-verification.ts` for the signing algorithm

### 1.2 waitUntil Spy

Mock `ExecutionContext` that captures lazy handler calls:

```ts
class SpyExecutionContext implements ExecutionContext {
  promises: Promise<any>[] = []
  waitUntil(p: Promise<any>) { this.promises.push(p) }
  async flush() { await Promise.all(this.promises) }
}
```

### 1.3 Payload Fixtures

`test/fixtures/` directory with real payloads captured from Phase 0.4 for each interaction type.

### 1.4 Behavioral Tests

Each test: construct a signed request → send through `app.run()` → assert response status + body + side effects.

| Test file | Covers | Key assertions |
|---|---|---|
| `slash-commands.test.ts` | `/command` handler | ack response body matches, lazy called via waitUntil |
| `events-api.test.ts` | `app.event()`, `app.message()`, `app.anyMessage()` | 200 + empty ack, lazy fires, URL verification challenge |
| `shortcuts.test.ts` | `app.globalShortcut()`, `app.messageShortcut()` | ack response, lazy fires |
| `block-actions.test.ts` | `app.action()` by string, regex, typed | ack response, lazy fires |
| `block-suggestions.test.ts` | `app.options()` | response has options/option_groups |
| `views.test.ts` | `app.viewSubmission()`, `app.viewClosed()` | ack with response_action, lazy fires |
| `middleware.test.ts` | `beforeAuthorize()`, `afterAuthorize()` | short-circuit or pass through |
| `signature-verification.test.ts` | invalid/missing signatures | 401 |
| `routing.test.ts` | `routes.events` path matching | 404 wrong path, 200 correct |

### 1.5 Type-Level Tests

Use `expect-type` (Vitest compatible) to verify the Hono ↔ slack-edge type bridge:
- `c.var.slack.client` is typed as `SlackAPIClient` (not `any`)
- `c.var.slackAuth` is typed as `AuthorizeResult`
- Handler request types preserve payload generics through the wrapper

These catch type regressions that runtime tests miss.

---

## Phase 2: Hono Middleware Wrapper (Approach B) ✅

Only start after Phase 1 tests are green against slack-edge.

### 2.1 `slackVerify()` — Signature Verification Middleware

```ts
import { createMiddleware } from 'hono/factory'

export const slackVerify = (signingSecret: string) =>
  createMiddleware(async (c, next) => {
    const rawBody = await c.req.text()
    const valid = await verifySlackRequest(signingSecret, c.req.raw.headers, rawBody)
    if (!valid) return c.text('Invalid signature', 401)
    c.set('slackRawBody', rawBody)
    await next()
  })
```

Reuses: `verifySlackRequest` from slack-edge's `src/request/request-verification.ts`

### 2.2 `slackAuthorize()` — Authorization Middleware

Extracts authorize step into Hono middleware. Sets result via `c.set('slackAuth', ...)`.

Reuses: `Authorize` type, `singleTeamAuthorize` from slack-edge

### 2.3 `SlackHonoApp` — Core Wrapper

Wraps `SlackApp`, replacing `run()` with a Hono handler:
- Uses `c.req.raw` as the Request
- Uses `c.executionCtx` for waitUntil (fallback: `NoopExecutionContext`)
- Exposes Slack context (`client`, `say`, `respond`, `botToken`, `authorizeResult`) via `c.set('slack', ...)`
- Listener registration API (`.command()`, `.event()`, etc.) unchanged

### 2.4 OAuth Routes as Hono Sub-App

Expose `SlackOAuthApp` install + callback as a Hono sub-app: `app.route('/slack', oauthRoutes)`.

Reuses: slack-edge's `src/oauth-app.ts`, `src/oauth/`

### 2.5 Type Definitions

```ts
type SlackHonoEnv = {
  Variables: {
    slack: { client: SlackAPIClient; say: Say; respond: Respond; ... }
    slackRawBody: string
    slackAuth: AuthorizeResult
  }
}
```

### 2.6 Run Phase 1 Tests Against slack-hono

Adapt integration tests to use Hono's test client (`app.request()`) instead of `app.run()` directly. All tests must stay green.

---

## Verification

1. ✅ `npm run typecheck` — no type errors
2. ✅ `npm test` — 43 tests green (11 test files)
3. ✅ Same behavioral tests green against slack-hono wrapper
4. ✅ Type-level tests pass (12 expect-type assertions)
5. ⬜ CI pipeline green on GitHub Actions — needs first commit + push
6. ⬜ Manual smoke test: deploy Hono + slack-hono to Cloudflare Workers, verify slash command works end-to-end

---

## Remaining Work

### Open Items
- **Phase 0.4**: Capture real payloads from a Slack test app (current fixtures are synthetic)
- **CI**: First commit + push to trigger GitHub Actions

### Completed Items
- ✅ **Phase 0.1**: README.md with API docs, before/after examples, all listener types
- ✅ **Phase 0.2**: Repo setup (package.json, tsconfig, vitest, biome, .gitignore, LICENSE)
- ✅ **Phase 0.3**: GitHub Actions CI workflow
- ✅ **Phase 1.1**: Request fixture factory (`test/helpers/slack-request-factory.ts`)
- ✅ **Phase 1.2**: SpyExecutionContext (`test/helpers/spy-execution-context.ts`)
- ✅ **Phase 1.3**: Payload fixtures for all interaction types (`test/fixtures/index.ts`)
- ✅ **Phase 1.4**: 31 behavioral tests across 10 test files
- ✅ **Phase 1.5**: 12 type-level tests with `expect-type` (`test/type-tests.test.ts`)
- ✅ **Phase 2.1**: `slackVerify()` standalone Hono middleware (`src/verify.ts`)
- ✅ **Phase 2.2**: `slackAuthorize()` standalone Hono middleware (`src/authorize.ts`)
- ✅ **Phase 2.3**: `SlackHonoApp` core wrapper with `handler()` method (`src/app.ts`)
- ✅ **Phase 2.4**: `SlackHonoOAuthApp` with OAuth/OIDC routes (`src/oauth-app.ts`)
- ✅ **Phase 2.5**: Type definitions (`src/types.ts`) — `SlackHonoEnv`, `SlackContext`, `SlackAuthorizeEnv`

### Implementation Notes
- `SlackHonoApp` extends `SlackApp` and adds a `handler()` method that returns a Hono sub-app
- `SlackHonoOAuthApp` extends `SlackOAuthApp` with Hono routes for OAuth start/callback/OIDC
- `slackVerify()` is a standalone Hono middleware for signature verification
- `slackAuthorize()` is a standalone Hono middleware for authorization (requires `slackVerify()` upstream)
- `c.executionCtx` throws in Hono test environment — wrapped in try/catch with `NoopExecutionContext` fallback
- Tests use a `mockAuthorize` function to avoid calling `auth.test` API (which `singleTeamAuthorize` does)
- slack-edge's internal routing checks the full URL path, so `SlackHonoApp.path` must match the full path (not relative to Hono mount point)
- `tsconfig.json` uses `lib: ["ES2022", "DOM", "DOM.Iterable"]` for web API types used in edge runtimes
