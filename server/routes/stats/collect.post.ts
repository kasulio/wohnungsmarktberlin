import { createLogger } from "~/lib/logger";

const log = createLogger("stats:collect");

export default defineEventHandler(async (e) => {
  const body = await readBody(e);

  try {
    const res = await fetch("https://speedin.site/stats/collect", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) {
      log.warn("analytics forward returned non-ok status", {
        status: res.status,
      });
    }
  } catch (error) {
    log.warn("analytics forward failed", { error });
  }
  return { success: true };
});
