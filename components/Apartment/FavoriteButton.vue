<script setup lang="ts">
const props = defineProps<{
  id: string;
}>();

const { isFavorite, toggle } = useFavorite(() => props.id);
const icon = ref<null | Element>(null);

watch(isFavorite, (newValue) => {
  const playerInstance = (icon.value as any)?.playerInstance;
  if (!playerInstance) return;
  playerInstance.direction = newValue ? 1 : -1;
  playerInstance.play();
});

onMounted(async () => {
  await nextTick();
  if (icon.value instanceof Element)
    icon.value.addEventListener("ready", () => {
      const playerInstance = (icon.value as any)?.playerInstance;
      if (playerInstance && isFavorite.value) {
        playerInstance.goToLastFrame();
      }
    });
});
</script>

<template>
  <ClientOnly>
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
        <lord-icon
          ref="icon"
          icon="heart"
          src="/icons/heart.json"
          state="morph-heart"
          class="current-color -m-1 md:hover:animate-zoombounce"
          style="width: 28px; height: 28px"
        />
      </span>
    </button>
    <template #fallback>
      <span class="current-color -m-1 flex">
        <lord-icon
          icon="heart"
          state="morph-heart"
          src="/icons/heart.json"
          style="width: 28px; height: 28px"
        />
      </span>
    </template>
  </ClientOnly>
</template>
