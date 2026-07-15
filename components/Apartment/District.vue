<script setup lang="ts">
import {
  UNKNOWN_DISTRICT_ID,
  unknownDistrict,
  zipCodeToDistrict,
} from "~/data/districts";

defineOptions({
  inheritAttrs: false,
});

const props = defineProps<{
  zipCode: string;
}>();

const district = computed(() => zipCodeToDistrict[props.zipCode]);
</script>

<template>
  <NuxtLink
    v-if="district"
    :to="`/overview?districts=${district.slug}`"
    :title="`Bezirk für ${zipCode}`"
    v-bind="$attrs"
  >
    {{ district.name }}
  </NuxtLink>
  <NuxtLink
    v-else
    :to="`/overview?districts=${UNKNOWN_DISTRICT_ID}`"
    :title="`Bezirk für ${zipCode}`"
    v-bind="$attrs"
  >
    {{ unknownDistrict.name }}
  </NuxtLink>
</template>
