import { beforeEach, describe, expect, test } from "bun:test";
import {
  evaluateTaskHeartbeats,
  markTaskFinished,
  markTaskSkipped,
  markTaskStarted,
  recordPmSyncResult,
  resetPipelineHealthForTests,
} from "./pipeline-health";

beforeEach(() => {
  resetPipelineHealthForTests();
});

describe("pipeline-health", () => {
  test("reports ok during startup grace period before tasks run", () => {
    const boot = 1_000_000;
    const evaluation = evaluateTaskHeartbeats({
      scheduledTasksEnabled: true,
      bootTime: boot,
      now: boot + 60_000,
    });
    expect(evaluation.status).toBe("ok");
    expect(evaluation.issues).toEqual([]);
  });

  test("flags stale tasks after boot window when scheduled tasks are enabled", () => {
    const boot = 1_000_000;
    const evaluation = evaluateTaskHeartbeats({
      scheduledTasksEnabled: true,
      bootTime: boot,
      now: boot + 20 * 60_000,
    });
    expect(evaluation.status).toBe("degraded");
    expect(evaluation.issues.some((i) => i.includes("update-flats"))).toBe(
      true,
    );
  });

  test("tracks task lifecycle, skips, and consecutive failure streaks", () => {
    const boot = 1_000_000;
    const now = boot + 5 * 60_000;
    markTaskStarted("extract-flats", now);
    markTaskSkipped("extract-flats");
    markTaskFinished(
      "extract-flats",
      { success: false, durationMs: 120, error: "timeout" },
      now + 120,
    );
    markTaskFinished(
      "extract-flats",
      { success: false, durationMs: 120, error: "timeout" },
      now + 240,
    );
    markTaskFinished(
      "extract-flats",
      { success: false, durationMs: 120, error: "timeout" },
      now + 360,
    );

    const evaluation = evaluateTaskHeartbeats({
      scheduledTasksEnabled: true,
      bootTime: boot,
      now: now + 400,
    });
    expect(evaluation.status).toBe("degraded");
    expect(
      evaluation.issues.some((i) =>
        i.includes("extract-flats failed 3 times in a row"),
      ),
    ).toBe(true);
    const extract = evaluation.tasks.find((t) => t.name === "extract-flats")!;
    expect(extract.skippedTicks).toBe(1);
    expect(extract.consecutiveFailures).toBe(3);

    markTaskFinished(
      "extract-flats",
      { success: true, durationMs: 50 },
      now + 500,
    );
    expect(
      evaluateTaskHeartbeats({
        scheduledTasksEnabled: true,
        bootTime: boot,
        now: now + 600,
      }).tasks.find((t) => t.name === "extract-flats")!.consecutiveFailures,
    ).toBe(0);
  });

  test("flags a PM failing 3 syncs in a row and clears on success", () => {
    expect(recordPmSyncResult("degewo", false).consecutiveFailures).toBe(1);
    expect(recordPmSyncResult("degewo", false).consecutiveFailures).toBe(2);
    expect(recordPmSyncResult("degewo", false).consecutiveFailures).toBe(3);

    const degraded = evaluateTaskHeartbeats({
      scheduledTasksEnabled: false,
    });
    expect(degraded.status).toBe("degraded");
    expect(degraded.issues).toContain("scraper degewo failed 3 syncs in a row");

    recordPmSyncResult("degewo", true);
    expect(
      evaluateTaskHeartbeats({ scheduledTasksEnabled: false }).status,
    ).toBe("ok");
  });
});
