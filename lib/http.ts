import {
  Clock,
  Context,
  Data,
  Duration,
  Effect,
  Layer,
  Schedule,
  Semaphore,
} from "effect";

export type HttpRequest = {
  url: string;
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: RequestInit["body"];
};

export type FetchOptions = Omit<HttpRequest, "url">;

export type HttpConfig = {
  userAgent: string;
  /** Per attempt, including reading the body. */
  timeout: Duration.Input;
  retries: number;
  retrySchedule: Schedule.Schedule<unknown>;
  /** Minimum pause between the end of one request to a host and the start of the next. */
  hostGap: Duration.Input;
};

type FetchFailure =
  | { reason: "status"; status: number }
  | { reason: "timeout"; after: string }
  | { reason: "network"; detail: string }
  | { reason: "body"; detail: string };

export class FetchError extends Data.TaggedError("FetchError")<{
  url: string;
  reason: FetchFailure["reason"];
  status?: number;
  message: string;
}> {
  static of(url: string, failure: FetchFailure) {
    const message =
      failure.reason === "status"
        ? `HTTP ${failure.status} for ${url}`
        : failure.reason === "timeout"
          ? `Timeout after ${failure.after} for ${url}`
          : failure.reason === "network"
            ? `Network error for ${url}: ${failure.detail}`
            : `Unreadable response from ${url}: ${failure.detail}`;
    return new FetchError({ url, ...failure, message });
  }
}

export type HttpClient = {
  text: (req: HttpRequest) => Effect.Effect<string, FetchError>;
  json: (req: HttpRequest) => Effect.Effect<unknown, FetchError>;
  bytes: (req: HttpRequest) => Effect.Effect<Uint8Array, FetchError>;
};

const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

const isRetryable = (error: FetchError) =>
  error.reason === "status"
    ? RETRYABLE_STATUS.has(error.status!)
    : error.reason !== "body";

export const makeHttp = (config: HttpConfig): HttpClient => {
  const timeoutLabel = Duration.format(
    Duration.fromInputUnsafe(config.timeout),
  );
  const gapMillis = Duration.toMillis(config.hostGap);
  const hosts = new Map<
    string,
    { semaphore: Semaphore.Semaphore; nextAt: number }
  >();

  /** One request at a time per host, each starting `hostGap` after the last ended. */
  const paced = <A, E, R>(url: string, effect: Effect.Effect<A, E, R>) => {
    const host = new URL(url).host;
    let gate = hosts.get(host);
    if (!gate) {
      gate = { semaphore: Semaphore.makeUnsafe(1), nextAt: 0 };
      hosts.set(host, gate);
    }
    const slot = gate;
    return slot.semaphore.withPermit(
      Effect.gen(function* () {
        const wait = slot.nextAt - (yield* Clock.currentTimeMillis);
        if (wait > 0) yield* Effect.sleep(Duration.millis(wait));
        return yield* effect;
      }).pipe(
        Effect.ensuring(
          Effect.map(Clock.currentTimeMillis, (now) => {
            slot.nextAt = now + gapMillis;
          }),
        ),
      ),
    );
  };

  const attempt = <A>(req: HttpRequest, read: (res: Response) => Promise<A>) =>
    Effect.gen(function* () {
      const res = yield* Effect.tryPromise({
        try: (signal) =>
          fetch(req.url, {
            method: req.method ?? "GET",
            headers: { "User-Agent": config.userAgent, ...req.headers },
            body: req.body,
            signal,
          }),
        catch: (cause) =>
          FetchError.of(req.url, { reason: "network", detail: String(cause) }),
      });
      if (!res.ok) {
        return yield* FetchError.of(req.url, {
          reason: "status",
          status: res.status,
        });
      }
      return yield* Effect.tryPromise({
        try: () => read(res),
        catch: (cause) =>
          FetchError.of(req.url, { reason: "body", detail: String(cause) }),
      });
    }).pipe(
      Effect.timeoutOrElse({
        duration: config.timeout,
        orElse: () =>
          Effect.fail(
            FetchError.of(req.url, { reason: "timeout", after: timeoutLabel }),
          ),
      }),
    );

  const request = <A>(req: HttpRequest, read: (res: Response) => Promise<A>) =>
    paced(req.url, attempt(req, read)).pipe(
      Effect.retry({
        times: config.retries,
        schedule: config.retrySchedule,
        while: isRetryable,
      }),
    );

  return {
    text: (req) => request(req, (res) => res.text()),
    json: (req) => request(req, (res) => res.json() as Promise<unknown>),
    bytes: (req) =>
      request(req, async (res) => new Uint8Array(await res.arrayBuffer())),
  };
};

/** Shared by every caller in this process, so pacing holds across tasks, admin runs and scrapers. */
export const liveHttp = makeHttp({
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
  timeout: "30 seconds",
  retries: 2,
  retrySchedule: Schedule.exponential("300 millis").pipe(Schedule.jittered),
  hostGap: "1 second",
});

export class Http extends Context.Service<Http, HttpClient>()("Http") {
  static readonly live = Layer.succeed(Http, liveHttp);
}

export function fetchHtml(
  url: string,
  options?: FetchOptions,
): Promise<string> {
  return Effect.runPromise(liveHttp.text({ url, ...options }));
}

export function fetchJson<T = unknown>(
  url: string,
  options?: FetchOptions,
): Promise<T> {
  return Effect.runPromise(liveHttp.json({ url, ...options })) as Promise<T>;
}
