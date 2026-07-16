<script setup lang="ts">
import type { LottieIconPlayer } from "~/utils/lottieIcons";

const props = defineProps<{
  id: string;
}>();

const { isFavorite, toggle } = useFavorite(() => props.id);
const player = shallowRef<LottieIconPlayer | null>(null);

watch(isFavorite, (newValue) => {
  const playerInstance = player.value;
  if (!playerInstance) return;
  playerInstance.direction = newValue ? 1 : -1;
  playerInstance.play();
});

function onIconReady(playerInstance: LottieIconPlayer) {
  player.value = playerInstance;
  if (isFavorite.value) {
    playerInstance.goToLastFrame();
  }
}
</script>

<template>
  <button
    class="inline-block"
    :title="`${
      isFavorite ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'
    }`"
    @click="() => toggle()"
  >
    <span
      class="flex transition-colors delay-200 duration-300"
      :class="{
        'text-accent': isFavorite,
        'text-black': !isFavorite,
      }"
    >
      <ClientOnly>
        <LottieIcon
          src="/icons/heart.json"
          state="morph-heart"
          class="current-color -m-1 md:hover:animate-zoombounce"
          style="width: 28px; height: 28px"
          @ready="onIconReady"
        >
          <img
            src="/icons/heart.svg"
            alt=""
          />
        </LottieIcon>
        <template #fallback>
          <span
            class="current-color -m-1 flex"
            style="width: 28px; height: 28px"
          >
            <img
              src="/icons/heart.svg"
              alt=""
              class="size-full"
            />
          </span>
        </template>
      </ClientOnly>
    </span>
  </button>
</template>
