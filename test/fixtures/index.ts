// Slack test fixtures — realistic payloads for each interaction type

import type { Authorize } from "slack-edge";

export const SIGNING_SECRET = "test-signing-secret-for-slack-hono";
export const BOT_TOKEN = "xoxb-test-bot-token-000";
export const TEAM_ID = "T0001";
export const BOT_ID = "B0001";
export const BOT_USER_ID = "U0001";
export const USER_ID = "U1234";
export const CHANNEL_ID = "C1234";

/**
 * Mock authorize function that returns a valid result without calling Slack API.
 */
export const mockAuthorize: Authorize = async () => ({
  botId: BOT_ID,
  botUserId: BOT_USER_ID,
  botToken: BOT_TOKEN,
  botScopes: ["commands", "chat:write"],
  teamId: TEAM_ID,
});

export const slashCommand = {
  command: "/hello",
  text: "world",
  response_url: "https://hooks.slack.com/commands/T0001/000/xxx",
  trigger_id: "111.222.xxx",
  user_id: USER_ID,
  user_name: "testuser",
  team_id: TEAM_ID,
  team_domain: "test-workspace",
  channel_id: CHANNEL_ID,
  channel_name: "general",
  api_app_id: "A0001",
  token: "deprecated-token",
};

export const urlVerificationEvent = {
  type: "url_verification",
  challenge: "test-challenge-string",
  token: "deprecated-token",
};

export const appMentionEvent = {
  type: "event_callback",
  token: "deprecated-token",
  team_id: TEAM_ID,
  api_app_id: "A0001",
  event_id: "Ev0001",
  event_time: 1234567890,
  authorizations: [
    {
      enterprise_id: null,
      team_id: TEAM_ID,
      user_id: BOT_USER_ID,
      is_bot: true,
    },
  ],
  event: {
    type: "app_mention",
    text: `<@${BOT_USER_ID}> hello`,
    user: USER_ID,
    channel: CHANNEL_ID,
    ts: "1234567890.000001",
    event_ts: "1234567890.000001",
  },
};

export const messageEvent = {
  type: "event_callback",
  token: "deprecated-token",
  team_id: TEAM_ID,
  api_app_id: "A0001",
  event_id: "Ev0002",
  event_time: 1234567890,
  authorizations: [
    {
      enterprise_id: null,
      team_id: TEAM_ID,
      user_id: BOT_USER_ID,
      is_bot: true,
    },
  ],
  event: {
    type: "message",
    text: "hello bot",
    user: USER_ID,
    channel: CHANNEL_ID,
    ts: "1234567890.000002",
    event_ts: "1234567890.000002",
    channel_type: "channel",
  },
};

export const globalShortcut = {
  type: "shortcut",
  callback_id: "test_global_shortcut",
  trigger_id: "111.222.xxx",
  user: { id: USER_ID, username: "testuser", team_id: TEAM_ID },
  team: { id: TEAM_ID, domain: "test-workspace" },
  token: "deprecated-token",
  action_ts: "1234567890.000001",
};

export const messageShortcut = {
  type: "message_action",
  callback_id: "test_message_shortcut",
  trigger_id: "111.222.xxx",
  user: { id: USER_ID, username: "testuser", team_id: TEAM_ID },
  team: { id: TEAM_ID, domain: "test-workspace" },
  channel: { id: CHANNEL_ID, name: "general" },
  message: {
    type: "message",
    text: "some message",
    user: USER_ID,
    ts: "1234567890.000001",
  },
  message_ts: "1234567890.000001",
  token: "deprecated-token",
  action_ts: "1234567890.000002",
  response_url: "https://hooks.slack.com/app/T0001/000/xxx",
};

export const blockAction = {
  type: "block_actions",
  trigger_id: "111.222.xxx",
  user: { id: USER_ID, username: "testuser", team_id: TEAM_ID },
  team: { id: TEAM_ID, domain: "test-workspace" },
  channel: { id: CHANNEL_ID, name: "general" },
  actions: [
    {
      type: "button",
      action_id: "test_action",
      block_id: "test_block",
      action_ts: "1234567890.000001",
      text: { type: "plain_text", text: "Click me" },
      value: "clicked",
    },
  ],
  token: "deprecated-token",
  response_url: "https://hooks.slack.com/actions/T0001/000/xxx",
};

export const blockSuggestion = {
  type: "block_suggestion",
  user: { id: USER_ID, username: "testuser", team_id: TEAM_ID },
  team: { id: TEAM_ID, domain: "test-workspace" },
  container: { type: "view", view_id: "V0001" },
  action_id: "test_options",
  block_id: "test_block",
  value: "search",
  token: "deprecated-token",
  api_app_id: "A0001",
};

export const viewSubmission = {
  type: "view_submission",
  user: { id: USER_ID, username: "testuser", team_id: TEAM_ID },
  team: { id: TEAM_ID, domain: "test-workspace" },
  view: {
    id: "V0001",
    type: "modal",
    callback_id: "test_view",
    title: { type: "plain_text", text: "Test Modal" },
    submit: { type: "plain_text", text: "Submit" },
    state: { values: {} },
    hash: "abc123",
    private_metadata: "",
    root_view_id: "V0001",
    app_id: "A0001",
    external_id: "",
    bot_id: BOT_ID,
  },
  token: "deprecated-token",
};

export const viewClosed = {
  type: "view_closed",
  user: { id: USER_ID, username: "testuser", team_id: TEAM_ID },
  team: { id: TEAM_ID, domain: "test-workspace" },
  view: {
    id: "V0001",
    type: "modal",
    callback_id: "test_view",
    title: { type: "plain_text", text: "Test Modal" },
    state: { values: {} },
    hash: "abc123",
    private_metadata: "",
    root_view_id: "V0001",
    app_id: "A0001",
    external_id: "",
    bot_id: BOT_ID,
  },
  is_cleared: false,
  token: "deprecated-token",
};
