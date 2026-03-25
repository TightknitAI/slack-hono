import type { ExecutionContext } from "slack-edge";

/**
 * Mock ExecutionContext that captures lazy handler promises via waitUntil.
 */
export class SpyExecutionContext implements ExecutionContext {
  promises: Promise<unknown>[] = [];

  waitUntil(promise: Promise<unknown>): void {
    this.promises.push(promise);
  }

  async flush(): Promise<void> {
    await Promise.allSettled(this.promises);
  }
}
