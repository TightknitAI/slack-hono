# Agents

Planning documents and implementation guides for slack-hono. These are instructions for AI agents (or humans) working on this codebase.

## Plans

| Document | Status | Description |
|---|---|---|
| [Approach B: Middleware Wrapper](./approach-b-middleware-wrapper.md) | ✅ Complete | Current implementation — wraps slack-edge as Hono middleware |
| [Approach C: Hono-Native Rewrite](./approach-c-hono-native.md) | 📋 Future | Replace slack-edge dispatch with native Hono routing |

## Architecture decisions

- **Approach B was chosen first** because it reuses slack-edge's battle-tested dispatch logic and gets us to a working library fast. ~60-70% of the work carries forward to Approach C.
- **Approach C should only be pursued** when Hono middleware composition is a real user need, not a theoretical one. See the decision criteria in the Approach C doc.

## Key context for agents

- The library wraps `slack-edge` — don't reimplement what slack-edge already does
- `SlackHonoApp` extends `SlackApp` from slack-edge, adding a `handler()` method
- Handler authors use slack-edge's context (`context.client`, `context.say`), not Hono's `c.var`
- The standalone middlewares (`slackVerify`, `slackAuthorize`) do use Hono's `c.var`
- Tests use `mockAuthorize` to avoid calling the real Slack API
- `builtBaseContext()` from slack-edge is used in `slackAuthorize` for proper context construction
