/**
 * Constructs properly signed Slack HTTP requests for testing.
 * Uses the same HMAC-SHA256 algorithm as slack-edge's request verification.
 */

const encoder = new TextEncoder();

async function sign(secret: string, timestamp: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(`v0:${timestamp}:${body}`));
  const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `v0=${hex}`;
}

export interface BuildSlackRequestOptions {
  signingSecret: string;
  body: Record<string, unknown>;
  contentType?: "json" | "urlencoded";
  headers?: Record<string, string>;
  path?: string;
  method?: string;
}

export async function buildSlackRequest(opts: BuildSlackRequestOptions): Promise<Request> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const isJson = opts.contentType === "json";

  let rawBody: string;
  if (isJson) {
    rawBody = JSON.stringify(opts.body);
  } else {
    // URL-encoded: if body has a "payload" key, encode it as payload=JSON
    if ("payload" in opts.body && typeof opts.body.payload === "object") {
      const params = new URLSearchParams();
      params.set("payload", JSON.stringify(opts.body.payload));
      rawBody = params.toString();
    } else {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(opts.body)) {
        params.set(k, String(v));
      }
      rawBody = params.toString();
    }
  }

  const signature = await sign(opts.signingSecret, timestamp, rawBody);

  const headers: Record<string, string> = {
    "x-slack-request-timestamp": timestamp,
    "x-slack-signature": signature,
    "content-type": isJson ? "application/json" : "application/x-www-form-urlencoded",
    ...opts.headers,
  };

  return new Request(`http://localhost${opts.path ?? "/slack/events"}`, {
    method: opts.method ?? "POST",
    headers,
    body: rawBody,
  });
}

/**
 * Build a URL-encoded interactivity payload (actions, shortcuts, views).
 * Slack sends these as payload=JSON in a URL-encoded body.
 */
export async function buildInteractivityRequest(
  signingSecret: string,
  payload: Record<string, unknown>,
  path?: string,
): Promise<Request> {
  return buildSlackRequest({
    signingSecret,
    body: { payload },
    contentType: "urlencoded",
    path,
  });
}
