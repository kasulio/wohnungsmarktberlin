import { logChannel } from "./log";
import { telegramChannel } from "./telegram/channel";
import type { Channel } from "./types";

/**
 * The available delivery channels, keyed by `Subscriber.channel`. Add the real
 * telegram / email channels here as they land — the sweep resolves a
 * subscriber's channel through this map and needs no other change.
 */
export const channels: Record<string, Channel> = {
  log: logChannel,
  telegram: telegramChannel,
};
