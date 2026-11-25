export type TrackedTaskName =
  | "update-flats"
  | "extract-flats"
  | "address-improvement"
  | "notify"
  | "update-map-preview";

export type TaskHeartbeat = {
  name: TrackedTaskName;
  running: boolean;
  lastStartedAt: string | null;
  lastFinishedAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  lastDurationMs: number | null;
  consecutiveFailures: number;
  skippedTicks: number;
  totalRuns: number;
  totalFailures: number;
  lastStats: unknown;
};

type InternalTaskState = {
  running: boolean;
  lastStartedAt: number | null;
  lastFinishedAt: number | null;
  lastSuccessAt: number | null;
  lastError: string | null;
  lastDurationMs: number | null;
  consecutiveFailures: number;
  skippedTicks: number;
  totalRuns: number;
  totalFailures: number;
  lastStats: unknown;
};

const ALL_TASKS: readonly TrackedTaskName[] = [
  "update-flats",
  "extract-flats",
  "address-improvement",
  "notify",
  "update-map-preview",
];

/** Max age since last successful run before a scheduled task is considered stale. */
export const TASK_STALE_MS: Record<TrackedTaskName, number> = {
  "update-flats": 10 * 60_000,
  "extract-flats": 10 * 60_000,
  "address-improvement": 10 * 60_000,
  notify: 10 * 60_000,
  "update-map-preview": 45 * 60_000,
};

/** Grace period after process boot before expecting cron heartbeats. */
const STARTUP_GRACE_MS = 3 * 60_000;

const startedAt = Date.now();
const taskStates = new Map<TrackedTaskName, InternalTaskState>();
const pmConsecutiveFailures = new Map<string, number>();

function getOrCreate(name: TrackedTaskName): InternalTaskState {
  let state = taskStates.get(name);
  if (!state) {
    state = {
      running: false,
      lastStartedAt: null,
      lastFinishedAt: null,
      lastSuccessAt: null,
      lastError: null,
      lastDurationMs: null,
      consecutiveFailures: 0,
      skippedTicks: 0,
      totalRuns: 0,
      totalFailures: 0,
      lastStats: null,
    };
    taskStates.set(name, state);
  }
  return state;
}

export function markTaskStarted(name: TrackedTaskName, now = Date.now()) {
  const s = getOrCreate(name);
  s.running = true;
  s.lastStartedAt = now;
}

export function markTaskSkipped(name: TrackedTaskName) {
  const s = getOrCreate(name);
  s.skippedTicks++;
}

export function markTaskFinished(
  name: TrackedTaskName,
  outcome: {
    success: boolean;
    durationMs: number;
    error?: string | null;
    stats?: unknown;
  },
  now = Date.now(),
): { consecutiveFailures: number } {
  const s = getOrCreate(name);
  s.running = false;
  s.lastFinishedAt = now;
  s.lastDurationMs = outcome.durationMs;
  s.totalRuns++;
  s.lastStats = outcome.stats ?? null;

  if (outcome.success) {
    s.lastSuccessAt = now;
    s.lastError = null;
    s.consecutiveFailures = 0;
  } else {
    s.totalFailures++;
    s.consecutiveFailures++;
    s.lastError = outcome.error ?? "unknown error";
  }

  return { consecutiveFailures: s.consecutiveFailures };
}

/** Tracks consecutive sync failures per PM so ops alerts trigger on streaks. */
export function recordPmSyncResult(
  slug: string,
  success: boolean,
): { consecutiveFailures: number } {
  if (success) {
    pmConsecutiveFailures.set(slug, 0);
    return { consecutiveFailures: 0 };
  }
  const next = (pmConsecutiveFailures.get(slug) ?? 0) + 1;
  pmConsecutiveFailures.set(slug, next);
  return { consecutiveFailures: next };
}

export function getTaskHeartbeats(): TaskHeartbeat[] {
  return ALL_TASKS.map((name) => {
    const s = getOrCreate(name);
    return {
      name,
      running: s.running,
      lastStartedAt: s.lastStartedAt
        ? new Date(s.lastStartedAt).toISOString()
        : null,
      lastFinishedAt: s.lastFinishedAt
        ? new Date(s.lastFinishedAt).toISOString()
        : null,
      lastSuccessAt: s.lastSuccessAt
        ? new Date(s.lastSuccessAt).toISOString()
        : null,
      lastError: s.lastError,
      lastDurationMs: s.lastDurationMs,
      consecutiveFailures: s.consecutiveFailures,
      skippedTicks: s.skippedTicks,
      totalRuns: s.totalRuns,
      totalFailures: s.totalFailures,
      lastStats: s.lastStats,
    };
  });
}

export type PipelineHealthEvaluation = {
  status: "ok" | "degraded";
  uptimeSeconds: number;
  scheduledTasksEnabled: boolean;
  issues: string[];
  tasks: TaskHeartbeat[];
};

export function evaluateTaskHeartbeats(options: {
  scheduledTasksEnabled: boolean;
  now?: number;
  bootTime?: number;
}): PipelineHealthEvaluation {
  const now = options.now ?? Date.now();
  const boot = options.bootTime ?? startedAt;
  const uptimeMs = Math.max(0, now - boot);
  const tasks = getTaskHeartbeats();
  const issues: string[] = [];

  if (options.scheduledTasksEnabled && uptimeMs > STARTUP_GRACE_MS) {
    for (const task of tasks) {
      // `update-map-preview` only runs every 15 min — don't flag before its first window.
      const maxAge = TASK_STALE_MS[task.name];
      if (!task.lastFinishedAt) {
        if (uptimeMs > maxAge) {
          issues.push(`task ${task.name} has never completed since boot`);
        }
        continue;
      }
      const lastSuccessMs = task.lastSuccessAt
        ? new Date(task.lastSuccessAt).getTime()
        : null;
      if (lastSuccessMs === null || now - lastSuccessMs > maxAge) {
        issues.push(
          `task ${task.name} has not succeeded in >${Math.round(maxAge / 60_000)}m`,
        );
      }
      if (task.consecutiveFailures >= 3) {
        issues.push(
          `task ${task.name} failed ${task.consecutiveFailures} times in a row (${task.lastError ?? "unknown"})`,
        );
      }
    }
  }

  for (const [slug, failures] of pmConsecutiveFailures.entries()) {
    if (failures >= 3) {
      issues.push(`scraper ${slug} failed ${failures} syncs in a row`);
    }
  }

  return {
    status: issues.length === 0 ? "ok" : "degraded",
    uptimeSeconds: Math.floor(uptimeMs / 1000),
    scheduledTasksEnabled: options.scheduledTasksEnabled,
    issues,
    tasks,
  };
}

/** Test helper to reset in-memory state. */
export function resetPipelineHealthForTests() {
  taskStates.clear();
  pmConsecutiveFailures.clear();
}
