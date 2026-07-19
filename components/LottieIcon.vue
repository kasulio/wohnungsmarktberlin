<script setup lang="ts">
import { getLottieIconHost, type LottieIconPlayer } from "~/utils/lottieIcons";

const props = withDefaults(
  defineProps<{
    src: string;
    trigger?: "hover" | null;
    state?: string | null;
  }>(),
  {
    trigger: null,
    state: null,
  },
);

const emit = defineEmits<{
  ready: [player: LottieIconPlayer];
}>();

const root = ref<HTMLElement | null>(null);
const host = ref<HTMLElement | null>(null);
const ready = ref(false);
const player = shallowRef<LottieIconPlayer | null>(null);

let destroyPlayer: (() => void) | null = null;
let cancelled = false;
let loadPromise: Promise<LottieIconPlayer | null> | null = null;

function bindHostApi() {
  const el = getLottieIconHost(root.value);
  if (!el) return;
  el.ensureLoaded = ensureLoaded;
  el.playerInstance = player.value ?? undefined;
}

function clearHostApi() {
  const el = getLottieIconHost(root.value);
  if (!el) return;
  delete el.ensureLoaded;
  delete el.playerInstance;
}

function attachPlayer(instance: LottieIconPlayer | null) {
  player.value = instance;
  const el = getLottieIconHost(root.value);
  if (el) el.playerInstance = instance ?? undefined;
}

async function ensureLoaded(): Promise<LottieIconPlayer | null> {
  if (player.value) return player.value;
  if (!import.meta.client || !host.value || !root.value) return null;

  loadPromise ??= (async () => {
    try {
      const { createLottieIconPlayer } = await import("~/utils/lottieIcons");
      const { player: instance, destroy } = await createLottieIconPlayer({
        container: host.value!,
        src: props.src,
        state: props.state,
      });
      if (cancelled) {
        destroy();
        loadPromise = null;
        return null;
      }
      destroyPlayer = destroy;
      attachPlayer(instance);
      ready.value = true;
      emit("ready", instance);
      return instance;
    } catch (error) {
      loadPromise = null;
      console.warn(`[LottieIcon] failed to load ${props.src}`, error);
      return null;
    }
  })();

  return loadPromise;
}

function onHover() {
  void ensureLoaded().then((instance) => {
    if (!instance || instance.isPlaying) return;
    instance.playFromBeginning();
  });
}

function onInteraction() {
  void ensureLoaded();
}

onMounted(() => {
  if (!import.meta.client || !root.value) return;

  bindHostApi();

  if (props.trigger === "hover") {
    root.value.addEventListener("pointerenter", onHover);
    return;
  }

  root.value.addEventListener("pointerenter", onInteraction, { once: true });
  root.value.addEventListener("pointerdown", onInteraction, { once: true });
});

onBeforeUnmount(() => {
  cancelled = true;
  root.value?.removeEventListener("pointerenter", onHover);
  root.value?.removeEventListener("pointerenter", onInteraction);
  root.value?.removeEventListener("pointerdown", onInteraction);
  destroyPlayer?.();
  destroyPlayer = null;
  loadPromise = null;
  attachPlayer(null);
  clearHostApi();
});

defineExpose({
  ensureLoaded,
  get playerInstance() {
    return player.value;
  },
});
</script>

<template>
  <span
    ref="root"
    class="lottie-icon"
    :class="{ 'lottie-icon--ready': ready }"
    data-lottie-icon
  >
    <span
      ref="host"
      class="lottie-icon__host"
      aria-hidden="true"
    />
    <span
      v-if="!ready"
      class="lottie-icon__fallback"
    >
      <slot />
    </span>
  </span>
</template>
