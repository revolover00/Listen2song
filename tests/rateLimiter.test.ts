import assert from "node:assert/strict";
import test from "node:test";
import type { Request, Response } from "express";
import { createInMemoryRateLimiter } from "../server/inMemoryRateLimiter";

function runRequest(handler: ReturnType<typeof createInMemoryRateLimiter>, ip: string) {
  const request = { ip, socket: { remoteAddress: ip } } as Request;
  const state: { status: number; headers: Record<string, string>; body?: unknown; nextCalls: number } = {
    status: 200,
    headers: {},
    nextCalls: 0,
  };
  const response = {
    setHeader(name: string, value: string) {
      state.headers[name] = value;
      return this;
    },
    status(code: number) {
      state.status = code;
      return this;
    },
    json(body: unknown) {
      state.body = body;
      return this;
    },
  } as unknown as Response;

  handler(request, response, () => {
    state.nextCalls += 1;
  });
  return state;
}

test("limits each client within a fixed window and includes Retry-After", () => {
  let now = 10_000;
  const limit = createInMemoryRateLimiter({ limit: 2, windowMs: 1_000, now: () => now });

  assert.equal(runRequest(limit, "192.0.2.1").nextCalls, 1);
  assert.equal(runRequest(limit, "192.0.2.1").nextCalls, 1);
  const blocked = runRequest(limit, "192.0.2.1");
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers["Retry-After"], "1");
  assert.equal(runRequest(limit, "192.0.2.2").nextCalls, 1);

  now += 1_001;
  assert.equal(runRequest(limit, "192.0.2.1").nextCalls, 1);
});

test("bounds memory by evicting the least-recently-used key at capacity", () => {
  const limit = createInMemoryRateLimiter({ limit: 1, maxKeys: 1, now: () => 100 });

  assert.equal(runRequest(limit, "192.0.2.1").nextCalls, 1);
  assert.equal(runRequest(limit, "192.0.2.2").nextCalls, 1);
  // The first key was evicted when capacity was reached; a new request for it is admitted.
  assert.equal(runRequest(limit, "192.0.2.1").nextCalls, 1);
});
