<template>
  <NuxtLink
    v-if="href"
    :to="disabled ? '' : href"
    class="inline-flex items-center justify-center gap-2 rounded-xl border border-primary bg-white px-6 py-4 text-m font-medium text-primary shadow-accent transition-shadow duration-200 hover:shadow-accentHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    :class="[
      disabled ? 'cursor-not-allowed opacity-60 hover:shadow-accent' : '',
      attrs.class,
    ]"
  >
    <slot></slot>
  </NuxtLink>
  <button
    v-else
    type="button"
    class="inline-flex items-center justify-center gap-2 rounded-xl border border-primary bg-white px-6 py-4 text-m font-medium text-primary shadow-accent transition-shadow duration-200 hover:shadow-accentHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    :class="[
      disabled ? 'cursor-not-allowed opacity-60 hover:shadow-accent' : '',
      attrs.class,
    ]"
    :disabled="disabled"
    @click="action"
  >
    <slot></slot>
  </button>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false });

defineProps<{
  action?: () => void;
  href?: string;
  disabled?: boolean;
}>();

const attrs = useAttrs();
</script>
