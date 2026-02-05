<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    alt: string;
    imageSrc: string | null;
    width?: number;
    height?: number;
    sizes?: string;
    loading?: "lazy" | "eager";
    class?: string;
  }>(),
  {
    width: 64,
    height: 64,
    loading: "lazy",
  },
);
const config = useRuntimeConfig();
const imgClass = computed(() => props.class || "h-16 w-16 rounded-lg");
</script>

<template>
  <NuxtImg
    :src="
      imageSrc ?? `${config.public.deploymentUrl}/apartment_example_image.png`
    "
    :alt="alt"
    :width="width"
    :height="height"
    :sizes="sizes"
    :loading="loading"
    :class="imgClass"
    format="avif,webp"
  />
</template>
