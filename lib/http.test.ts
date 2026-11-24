import { afterAll, beforeEach, expect, test } from "bun:test";
import { Effect, Result, Schedule } from "effect";
import { type HttpConfig, makeHttp } from "./http";

type Hit = { path: string; at: number; userAgent: string | null };
const hits: Hit[] = [];

const server = Bun.serve({
  port: 0,
  async fetch(req) {
    const path = new URL(req.url).pathname;
    hits.push({
      path,
      at: performance.now(),
      userAgent: req.headers.get("user-agent"),
    });
    const n = hits.filter((h) => h.path === path).length;
    switch (path) {
      case "/ok":
        return new Response("<html>ok</html>");
      case "/flaky":
        return n < 3
          ? new Response("busy", { status: n === 1 ? 503 : 429 })
          : new Response("ok");
      case "/slow-once":
        if (n === 1) await Bun.sleep(1000);
        return new Response("late but ok");
      case "/hang":
        await Bun.sleep(1000);
        return new Response("too late");
      case "/echo":
        return Response.json({
          method: req.method,
          cookie: req.headers.get("cookie"),
          body: await req.text(),
        });
      case "/gone":
        return new Response("nope", { status: 404 });
      default:
        return new Response("?", { status: 500 });
    }
  },
});
afterAll(() => server.stop(true));
beforeEach(() => {
  hits.length = 0;
});

const config: HttpConfig = {
  userAgent: "test-agent",
  timeout: "200 millis",
  retries: 2,
  retrySchedule: Schedule.forever,
  hostGap: "0 millis",
};
const http = makeHttp(config);
const url = (path: string) => `http://localhost:${server.port}${path}`;

test("returns the body of a successful response, sent with our user agent", async () => {
  const body = await Effect.runPromise(http.text({ url: url("/ok") }));
  expect(body).toBe("<html>ok</html>");
  expect(hits).toEqual([
    expect.objectContaining({ path: "/ok", userAgent: "test-agent" }),
  ]);
});

const failure = async <A, E>(effect: Effect.Effect<A, E>) => {
  const result = await Effect.runPromise(Effect.result(effect));
  if (Result.isSuccess(result)) throw new Error("expected a failure");
  return result.failure;
};

test("fails a 404 at once with a FetchError naming status and url", async () => {
  const error = await failure(http.text({ url: url("/gone") }));
  expect(error).toMatchObject({
    _tag: "FetchError",
    reason: "status",
    status: 404,
  });
  expect(error.message).toBe(`HTTP 404 for ${url("/gone")}`);
  expect(hits.length).toBe(1);
});

test("retries 503 and 429 until the site answers", async () => {
  const body = await Effect.runPromise(http.text({ url: url("/flaky") }));
  expect(body).toBe("ok");
  expect(hits.length).toBe(3);
});

test("gives up after the configured retries with the last status", async () => {
  const error = await failure(http.text({ url: url("/down") }));
  expect(error).toMatchObject({ reason: "status", status: 500 });
  expect(hits.length).toBe(3);
});

test("times out each attempt on its own and retries", async () => {
  const body = await Effect.runPromise(http.text({ url: url("/slow-once") }));
  expect(body).toBe("late but ok");
  expect(hits.length).toBe(2);
});

test("reports a timeout once every attempt hung", async () => {
  const error = await failure(http.text({ url: url("/hang") }));
  expect(error).toMatchObject({ reason: "timeout" });
  expect(error.message).toBe(`Timeout after 200ms for ${url("/hang")}`);
  expect(hits.length).toBe(3);
});

test("spaces requests to one host by the host gap, even when fired together", async () => {
  const paced = makeHttp({ ...config, hostGap: "100 millis" });
  await Effect.runPromise(
    Effect.all(
      [1, 2, 3].map(() => paced.text({ url: url("/ok") })),
      { concurrency: "unbounded" },
    ),
  );
  const gaps = hits.slice(1).map((h, i) => h.at - hits[i]!.at);
  expect(gaps.length).toBe(2);
  for (const gap of gaps) expect(gap).toBeGreaterThanOrEqual(95);
});

test("does not delay requests to a different host", async () => {
  const paced = makeHttp({ ...config, hostGap: "1 second" });
  const started = performance.now();
  await Effect.runPromise(
    Effect.all([
      paced.text({ url: url("/ok") }),
      paced.text({ url: `http://127.0.0.1:${server.port}/ok` }),
    ]),
  );
  expect(performance.now() - started).toBeLessThan(500);
});

test("sends method, headers and body, and parses a JSON answer", async () => {
  const answer = await Effect.runPromise(
    http.json({
      url: url("/echo"),
      method: "POST",
      headers: { Cookie: "consent=1" },
      body: JSON.stringify({ offset: 0 }),
    }),
  );
  expect(answer).toEqual({
    method: "POST",
    cookie: "consent=1",
    body: '{"offset":0}',
  });
});
