import { expectTypeOf } from "expect-type";
import type { Hono } from "hono";
import type { AuthorizeResult } from "slack-edge";
import type { SlackAPIClient } from "slack-web-api-client";
import { describe, it } from "vitest";
import type { SlackAuthorizeEnv } from "../src/authorize";
import type { SlackContext, SlackHonoEnv } from "../src/types";

describe("type-level tests", () => {
  // SlackContext type (exported for custom middleware use)
  it("SlackContext.client is typed as SlackAPIClient", () => {
    expectTypeOf<SlackContext["client"]>().toEqualTypeOf<SlackAPIClient>();
  });

  it("SlackContext.authorizeResult is typed as AuthorizeResult", () => {
    expectTypeOf<SlackContext["authorizeResult"]>().toEqualTypeOf<AuthorizeResult>();
  });

  it("SlackContext.botToken is string", () => {
    expectTypeOf<SlackContext["botToken"]>().toBeString();
  });

  it("SlackContext.botId is string", () => {
    expectTypeOf<SlackContext["botId"]>().toBeString();
  });

  it("SlackContext.botUserId is string", () => {
    expectTypeOf<SlackContext["botUserId"]>().toBeString();
  });

  it("SlackContext.userToken is optional string", () => {
    expectTypeOf<SlackContext["userToken"]>().toEqualTypeOf<string | undefined>();
  });

  // SlackHonoEnv variables
  it("SlackHonoEnv.Variables.slackRawBody is string", () => {
    expectTypeOf<SlackHonoEnv["Variables"]["slackRawBody"]>().toBeString();
  });

  it("SlackHonoEnv.Variables.slackAuth is AuthorizeResult", () => {
    expectTypeOf<SlackHonoEnv["Variables"]["slackAuth"]>().toEqualTypeOf<AuthorizeResult>();
  });

  it("SlackHonoEnv does not have a slack variable", () => {
    expectTypeOf<SlackHonoEnv["Variables"]>().not.toHaveProperty("slack");
  });

  // SlackAuthorizeEnv
  it("SlackAuthorizeEnv.Variables.slackAuth is AuthorizeResult", () => {
    expectTypeOf<SlackAuthorizeEnv["Variables"]["slackAuth"]>().toEqualTypeOf<AuthorizeResult>();
  });

  // Hono compatibility
  it("SlackHonoEnv is assignable to Hono Env", () => {
    expectTypeOf<Hono<SlackHonoEnv>>().toBeObject();
  });

  it("combined env works with Hono", () => {
    type CombinedEnv = SlackHonoEnv & SlackAuthorizeEnv;
    expectTypeOf<Hono<CombinedEnv>>().toBeObject();
  });
});
