import type { Channel } from "./types";

/**
 * No-op channel that only logs. Serves both as the transport for code-defined
 * `log:*` subscribers and as a stand-in while real channels (telegram, email)
 * are built — it exercises the full sweep (matching, ledger, watermark) without
 * sending anything.
 */
export const logChannel: Channel = {
  async send(target, flat) {
    console.log(
      `[notify] (log:${target}) ${flat.id} — ${flat.title} (${flat.url})`,
    );
    return { ok: true };
  },
};
