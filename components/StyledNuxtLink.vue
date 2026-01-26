<script lang="ts" setup>
import type { NuxtLinkProps } from "#app";

const props = defineProps<
  NuxtLinkProps & {
    hideIcon?: boolean;
    iconClass?: string;
    noUnderline?: boolean;
  }
>();

const isExternal = computed(
  () => typeof props.to === "string" && props.to.startsWith("http"),
);
const showIcon = computed(() => !props.hideIcon && isExternal.value);
</script>

<template>
  <NuxtLink
    v-bind="props"
    :target="isExternal ? '_blank' : undefined"
    :class="{
      'inline-flex items-center gap-x-1': showIcon,
      'underline hover:no-underline': !props.noUnderline,
    }"
  >
    <slot></slot>
    <IconExternalLink
      v-if="showIcon"
      class="block h-4 w-4"
      :class="props.iconClass"
    />
  </NuxtLink>
</template>
