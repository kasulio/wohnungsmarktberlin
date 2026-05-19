<script setup lang="ts">
import { tags } from "~/data/tags";
import type { Tags } from "~/data/tags";

defineProps<{
  tag: Tags[number];
}>();
</script>

<template>
  <NuxtLink
    :to="`/overview?tags=${tag}`"
    class="py-0.25 inline-flex items-center gap-1 rounded-full border border-main/10 bg-secondary/60 px-2.5 text-xs font-medium text-accent transition-colors hover:border-accent/40"
  >
    {{ tags[tag] }}
    <svg
      v-if="tag === 'new'"
      class="h-3 w-3 shrink-0 text-accent"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 14 14"
    >
      <path
        d="M4.4,8.95c3.17,0,4.55-1.33,4.55-4.55,0,3.22,1.37,4.55,4.55,4.55-3.18,0-4.55,1.37-4.55,4.55,0-3.18-1.38-4.55-4.55-4.55ZM.5,3.42c2.04,0,2.92-.86,2.92-2.92,0,2.07.88,2.92,2.92,2.92-2.04,0-2.92.88-2.92,2.92,0-2.04-.89-2.92-2.92-2.92Z"
        fill="currentColor"
        stroke="currentColor"
        stroke-linejoin="round"
      />
    </svg>
  </NuxtLink>
</template>
