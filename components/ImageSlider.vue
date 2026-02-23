<script setup lang="ts">
const props = defineProps({
  images: {
    type: Array,
    default: () => ["simone-hutsch-YsEOuVd7afg-unsplash.jpg"],
  },
  interval: {
    type: Number,
    default: 7000,
  }, // Time in milliseconds for each image transition
});
const currentImageIndex = ref(0);
const autoAdvance = () => {
  currentImageIndex.value = (currentImageIndex.value + 1) % props.images.length;
};
// Start the automatic image transition when the component is mounted
let intervalId: number;
onMounted(() => {
  intervalId = props.interval; // Default to 5 seconds
  setInterval(autoAdvance, intervalId);
});
onUnmounted(() => {
  // Stop the automatic image transition when the component is unmounted
  clearInterval(intervalId);
});
</script>

<template>
  <transition-group
    tag="div"
    class="relative h-full w-full"
    name="fade"
    mode="out-in"
  >
    <NuxtImg
      :key="currentImageIndex"
      :src="`/decoration/${images[currentImageIndex]}`"
      alt=""
      role="presentation"
      class="absolute h-full w-full object-cover"
      sizes="100vw sm:50vw md:400px"
      format="avif,webp"
    />
  </transition-group>
</template>

<style scoped>
.fade-move, /* apply transition to moving elements */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 1s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* ensure leaving items are taken out of layout flow so that moving
   animations can be calculated correctly. */
.fade-leave-active {
  position: absolute;
}
</style>
