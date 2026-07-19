<template>
  <NuxtLink
    v-if="href"
    :to="disabled ? '' : href"
    :target="target"
    :rel="target === '_blank' ? 'noopener noreferrer' : undefined"
    :class="[baseClass, variantClass, sizeClass, disabledClass, attrs.class]"
    v-bind="forwardedAttrs"
  >
    <slot></slot>
  </NuxtLink>
  <button
    v-else
    type="button"
    :class="[baseClass, variantClass, sizeClass, disabledClass, attrs.class]"
    :disabled="disabled"
    v-bind="forwardedAttrs"
    @click="action"
  >
    <slot></slot>
  </button>
</template>

<script setup lang="ts">
import type { RouteLocationRaw } from "vue-router";

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    action?: () => void;
    href?: RouteLocationRaw;
    disabled?: boolean;
    size?: "default" | "sm";
    variant?: "primary" | "secondary";
    target?: string;
  }>(),
  {
    size: "default",
    variant: "primary",
  },
);

const attrs = useAttrs();

const forwardedAttrs = computed(() => {
  const { class: _class, ...rest } = attrs;
  return rest;
});

const baseClass =
  "inline-flex items-center justify-center gap-2 rounded-xl border font-medium transition-shadow duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const variantClass = computed(() =>
  props.variant === "secondary"
    ? "border-primary bg-white text-primary shadow-[#6B6B8A_-7px_7px] hover:shadow-[#6B6B8A_-4px_4px]"
    : "border-primary bg-white text-primary shadow-accent hover:shadow-accentHover",
);

const sizeClass = computed(() =>
  props.size === "sm"
    ? "px-4 py-2.5 text-s"
    : "px-4 py-3 text-s md:px-6 md:py-4 md:text-m",
);

const disabledClass = computed(() =>
  props.disabled ? "cursor-not-allowed opacity-60 hover:shadow-none" : "",
);
</script>
