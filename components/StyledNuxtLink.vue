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
    :target="isExternal ? '_blank' : props.target"
    :class="{
      'inline-flex items-center gap-x-1': showIcon,
      'underline hover:no-underline': !props.noUnderline,
    }"
  >
    <slot></slot>
    <Icon
      name="lucide:external-link"
      v-if="showIcon"
      class="size-4 shrink-0"
      :class="props.iconClass"
    />
  </NuxtLink>
</template>
