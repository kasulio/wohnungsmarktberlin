<script setup lang="ts">
import { describeFlatFilter } from "~/lib/describe-flat-filter";

const { $client } = useNuxtApp();

const recipients = await $client.notification.listRecipients.useQuery();

type Recipient = NonNullable<typeof recipients.data.value>[number];

const recipientKey = (r: Recipient) => `${r.channel}:${r.target}`;

const expanded = ref(new Set<string>());
const toggle = (key: string) => {
  const next = new Set(expanded.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  expanded.value = next;
};

const channelLabel = (channel: string) =>
  channel === "telegram" ? "Telegram" : channel === "log" ? "Log" : channel;

/** Chat ids are personal; the last digits are enough to tell chats apart. */
const targetLabel = (r: Recipient) =>
  r.channel === "telegram" ? `•••${r.target.slice(-4)}` : r.target;

const subscriptionCount = computed(() =>
  (recipients.data.value ?? []).reduce(
    (sum, r) => sum + r.subscriptions.length,
    0,
  ),
);

const formatDate = (d: string | Date) =>
  new Date(d).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });

const testingKey = ref<string | null>(null);
const feedback = ref<{ ok: boolean; msg: string } | null>(null);

const sendTest = async (r: Recipient) => {
  if (testingKey.value) return;
  const subscriberId = r.subscriptions[0]?.id;
  if (!subscriberId) return;
  testingKey.value = recipientKey(r);
  feedback.value = null;
  try {
    const res = await $client.notification.sendTest.mutate({ subscriberId });
    feedback.value = {
      ok: res.ok,
      msg: res.ok
        ? `Test an ${channelLabel(r.channel)} ${targetLabel(r)} gesendet (Wohnung ${res.flatId}).`
        : res.blocked
          ? "Empfänger blockiert oder nicht erreichbar."
          : "Senden fehlgeschlagen (siehe Server-Logs).",
    };
  } catch (e) {
    feedback.value = {
      ok: false,
      msg: e instanceof Error ? e.message : "Anfrage fehlgeschlagen.",
    };
  } finally {
    testingKey.value = null;
    await recipients.refresh();
  }
};
</script>

<template>
  <section class="space-y-3">
    <h2 class="text-l font-semibold text-main">
      Empfänger
      <span class="text-s font-normal text-gray-500">
        · {{ recipients.data.value?.length ?? 0 }} Ziele,
        {{ subscriptionCount }} Abos
      </span>
    </h2>
    <div
      v-if="feedback"
      role="status"
      class="text-sm rounded-2xl border px-4 py-3"
      :class="
        feedback.ok
          ? 'border-green-800/35 bg-green-100/90 text-green-950'
          : 'border-red-600 bg-red-50 text-red-900'
      "
    >
      {{ feedback.msg }}
    </div>
    <ul
      role="list"
      class="overflow-hidden rounded-3xl border border-black bg-white text-s"
    >
      <li
        v-for="r in recipients.data.value ?? []"
        :key="recipientKey(r)"
        class="border-b border-black/10 last:border-b-0"
        :class="r.active ? '' : 'opacity-60'"
      >
        <div class="flex items-center gap-3 px-4 py-3">
          <button
            type="button"
            class="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-0.5 text-left"
            :aria-expanded="expanded.has(recipientKey(r))"
            @click="toggle(recipientKey(r))"
          >
            <span
              class="inline-flex items-baseline gap-1.5 font-semibold text-main"
            >
              <span
                class="w-3 text-primary"
                aria-hidden="true"
                >{{ expanded.has(recipientKey(r)) ? "▾" : "▸" }}</span
              >
              {{ channelLabel(r.channel) }}
              <span
                class="font-mono text-xs font-normal text-gray-600"
                :title="r.target"
                >{{ targetLabel(r) }}</span
              >
            </span>
            <span class="text-xs text-gray-500">
              {{ r.subscriptions.length }}
              {{ r.subscriptions.length === 1 ? "Abo" : "Abos" }} ·
              {{ r.delivered }} gesendet
              <template v-if="r.lastSentAt">
                · zuletzt {{ formatAgo(r.lastSentAt) }}
              </template>
            </span>
            <span
              v-if="r.source === 'static'"
              class="rounded-full bg-secondary px-2 text-xs text-main"
              >im Code</span
            >
            <span
              v-if="!r.active"
              class="rounded-full bg-red-100 px-2 text-xs font-semibold text-red-900"
              >inaktiv</span
            >
          </button>
          <button
            type="button"
            class="inline-flex shrink-0 items-center gap-1 rounded-lg border border-black/70 bg-white px-2.5 py-1.5 text-xs font-medium text-main hover:bg-black/[0.03] disabled:opacity-50"
            :disabled="testingKey != null"
            @click="sendTest(r)"
          >
            Test
            <LoadingSpinner
              v-if="testingKey === recipientKey(r)"
              class="!h-4 !w-4"
            />
          </button>
        </div>
        <ul
          v-if="expanded.has(recipientKey(r))"
          role="list"
          class="mx-4 mb-3 border-l-2 border-secondary pl-3 text-xs"
        >
          <li
            v-for="s in r.subscriptions"
            :key="s.id"
            class="flex items-baseline justify-between gap-3 border-b border-dashed border-black/10 py-1.5 last:border-b-0"
            :class="s.active ? 'text-main' : 'text-gray-400 line-through'"
          >
            <span class="min-w-0">{{ describeFlatFilter(s.filter) }}</span>
            <span class="shrink-0 tabular-nums text-gray-500">
              {{ s.sentCount }} · seit {{ formatDate(s.createdAt) }}
            </span>
          </li>
        </ul>
      </li>
      <li
        v-if="!(recipients.data.value ?? []).length"
        class="px-4 py-6 text-center text-gray-500"
      >
        Keine Empfänger.
      </li>
    </ul>
  </section>
</template>
