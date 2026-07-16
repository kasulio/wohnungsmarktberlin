<script setup lang="ts">
import {
  createLottieIconPlayer,
  type LottieIconPlayer,
} from "~/utils/lottieIcons";

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

function attachPlayer(instance: LottieIconPlayer | null) {
  player.value = instance;
  if (root.value) {
    (
      root.value as HTMLElement & { playerInstance?: LottieIconPlayer }
    ).playerInstance = instance ?? undefined;
  }
}

function onHover() {
  const instance = player.value;
  if (!instance || instance.isPlaying) return;
  instance.playFromBeginning();
}

onMounted(async () => {
  if (!import.meta.client || !host.value || !root.value) return;

  try {
    const { player: instance, destroy } = await createLottieIconPlayer({
      container: host.value,
      src: props.src,
      state: props.state,
    });
    if (cancelled) {
      destroy();
      return;
    }
    destroyPlayer = destroy;
    attachPlayer(instance);
    ready.value = true;
    emit("ready", instance);

    if (props.trigger === "hover") {
      root.value.addEventListener("mouseenter", onHover);
    }
  } catch (error) {
    // Keep static fallback visible if animation boot fails.
    console.warn(`[LottieIcon] failed to load ${props.src}`, error);
  }
});

onBeforeUnmount(() => {
  cancelled = true;
  root.value?.removeEventListener("mouseenter", onHover);
  destroyPlayer?.();
  destroyPlayer = null;
  attachPlayer(null);
});

defineExpose({
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
