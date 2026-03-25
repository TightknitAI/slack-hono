import { describe, expect, it } from "vitest";
import { SlackHonoApp } from "../../src/index";
import * as fixtures from "../fixtures";
import { buildInteractivityRequest, SpyExecutionContext } from "../helpers";

function createApp() {
  return new SlackHonoApp({
    env: {
      SLACK_SIGNING_SECRET: fixtures.SIGNING_SECRET,
      SLACK_BOT_TOKEN: fixtures.BOT_TOKEN,
      SLACK_LOGGING_LEVEL: "ERROR",
    },
    authorize: fixtures.mockAuthorize,
  });
}

describe("block suggestions", () => {
  it("returns options from ack handler", async () => {
    const app = createApp();
    const options = {
      options: [
        { text: { type: "plain_text", text: "Option 1" }, value: "opt1" },
        { text: { type: "plain_text", text: "Option 2" }, value: "opt2" },
      ],
    };

    app.options("test_options", async () => options);

    const ctx = new SpyExecutionContext();
    const req = await buildInteractivityRequest(fixtures.SIGNING_SECRET, fixtures.blockSuggestion);

    const res = await app.run(req, ctx);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.options).toHaveLength(2);
    expect(body.options[0].value).toBe("opt1");
  });

  it("returns option_groups from ack handler", async () => {
    const app = createApp();
    const optionGroups = {
      option_groups: [
        {
          label: { type: "plain_text", text: "Group 1" },
          options: [{ text: { type: "plain_text", text: "Opt A" }, value: "a" }],
        },
      ],
    };

    app.options("test_options", async () => optionGroups);

    const ctx = new SpyExecutionContext();
    const req = await buildInteractivityRequest(fixtures.SIGNING_SECRET, fixtures.blockSuggestion);

    const res = await app.run(req, ctx);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.option_groups).toHaveLength(1);
  });
});
