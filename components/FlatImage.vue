<script setup lang="ts">
import { getFlatImageUrl } from "~/utils/flat";

const props = withDefaults(
  defineProps<{
    flat:
      | { id: string; hasImage: boolean }
      | { id: string; imageSrc: string | null };
    alt: string;
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

const imgUrl = computed(() => {
  const hasImage =
    "hasImage" in props.flat
      ? props.flat.hasImage
      : Boolean(props.flat.imageSrc);
  return getFlatImageUrl({ id: props.flat.id, hasImage });
});

const imgClass = computed(() => props.class || "h-16 w-16 rounded-lg");
</script>

<template>
  <NuxtImg
    :src="imgUrl"
    :alt="alt"
    :width="width"
    :height="height"
    :sizes="sizes"
    :loading="loading"
    :class="imgClass"
    format="avif,webp"
  />
</template>
