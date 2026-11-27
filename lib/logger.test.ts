import { afterEach, describe, expect, test } from "bun:test";
import { createLogger, serializeError } from "./logger";

const prevEnv = {
  LOG_FORMAT: process.env.LOG_FORMAT,
  LOG_LEVEL: process.env.LOG_LEVEL,
};

afterEach(() => {
  if (prevEnv.LOG_FORMAT === undefined) delete process.env.LOG_FORMAT;
  else process.env.LOG_FORMAT = prevEnv.LOG_FORMAT;
  if (prevEnv.LOG_LEVEL === undefined) delete process.env.LOG_LEVEL;
  else process.env.LOG_LEVEL = prevEnv.LOG_LEVEL;
});

describe("logger", () => {
  test("serializes Error objects with message, stack, and extra fields", () => {
    const err = Object.assign(new Error("boom"), {
      status: 503,
      _tag: "FetchError",
    });
    const serialized = serializeError(err);
    expect(serialized).toMatchObject({
      name: "Error",
      message: "boom",
      status: 503,
      tag: "FetchError",
    });
    expect(typeof serialized.stack).toBe("string");
  });

  test("emits JSON lines with child context and respects LOG_LEVEL", () => {
    process.env.LOG_FORMAT = "json";
    process.env.LOG_LEVEL = "warn";

    const lines: string[] = [];
    const origLog = console.log;
    const origWarn = console.warn;
    console.log = (s: string) => lines.push(s);
    console.warn = (s: string) => lines.push(s);

    try {
      const log = createLogger("test-scope").child({ runId: "r1" });
      log.info("filtered out");
      log.warn("kept", { pm: "degewo" });
    } finally {
      console.log = origLog;
      console.warn = origWarn;
    }

    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]!)).toMatchObject({
      level: "warn",
      scope: "test-scope",
      msg: "kept",
      runId: "r1",
      pm: "degewo",
    });
  });
});
