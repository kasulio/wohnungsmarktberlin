<script setup lang="ts">
import type { LottieIconExpose, LottieIconPlayer } from "~/utils/lottieIcons";

const modalOpen = ref(false);
const player = shallowRef<LottieIconPlayer | null>(null);
const heartIcon = ref<LottieIconExpose | null>(null);
const { favorites } = useFavorites();

watch(modalOpen, (newValue) => {
  const playerInstance = player.value;
  if (!playerInstance) return;
  playerInstance.direction = newValue ? 1 : -1;
  playerInstance.play();
});

function onIconReady(playerInstance: LottieIconPlayer) {
  player.value = playerInstance;
  if (modalOpen.value) {
    playerInstance.direction = 1;
    playerInstance.goToLastFrame();
  }
}

async function openFavorites() {
  const instance = await heartIcon.value?.ensureLoaded();
  if (instance) player.value = instance;
  modalOpen.value = true;
}
</script>
<template>
  <div class="favorites relative cursor-pointer">
    <LottieIcon
      ref="heartIcon"
      src="/icons/heart.json"
      state="morph-heart"
      class="hover:animate-zoombounce"
      style="width: 32px; height: 32px"
      @ready="onIconReady"
      @click="openFavorites"
    >
      <img
        src="/icons/heart.svg"
        alt=""
      />
    </LottieIcon>
    <ClientOnly>
      <div
        class="top absolute right-0 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-accent text-[0.5rem] font-bold leading-none text-white"
      >
        <ClientOnly fallback="0">{{ favorites?.length }}</ClientOnly>
      </div>
      <Modal
        :open="modalOpen"
        :on-close="() => (modalOpen = false)"
        class="absolute -right-8 top-12 z-20 flex max-h-[30rem] w-72 flex-col gap-4 overflow-y-auto rounded-xl border border-black bg-white p-4 text-left shadow-xl md:right-0 md:w-80"
      >
        <div
          v-if="favorites?.length === 0"
          class="text-center"
        >
          Du hast noch keine Favoriten gefunden :(
          <br />
        </div>
        <NuxtLink
          v-for="favorite in favorites ?? []"
          v-else
          :key="favorite.id"
          :to="favorite.url"
          target="_blank"
          title="Zur Wohnung"
          class="flex items-center gap-2"
        >
          <FlatImage
            :id="favorite.id"
            :has-image="favorite.hasImage"
            :alt="`Vorschaubild ${favorite.title}`"
            class="h-12 w-12 rounded-md xs:h-16 xs:w-16"
          />
          <div class="flex grow flex-col">
            <div class="flex items-center gap-2">
              <span
                class="line-clamp-2 max-w-40 grow overflow-hidden text-ellipsis text-s leading-snug md:line-clamp-3"
              >
                {{ favorite.title }}</span
              >
              <span class="text-s font-light">
                <span class="block">{{
                  formatPrimaryRent(favorite, true)
                }}</span>
                <span class="block">{{ formatArea(favorite.usableArea) }}</span>
              </span>
            </div>
          </div>
        </NuxtLink>
      </Modal>
    </ClientOnly>
  </div>
</template>
