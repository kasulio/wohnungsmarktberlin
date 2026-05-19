<script setup lang="ts">
import type { Tags } from "~/data/tags";

const props = withDefaults(
  defineProps<{
    propertyManagementId?: string | null;
    tags: Tags;
  }>(),
  { propertyManagementId: null },
);

const provider = computed(() => {
  const id = props.propertyManagementId;
  if (!id) return null;
  const name = getProviderName(id);
  return name ? { id, name } : null;
});
</script>

<template>
  <ApartmentProvider
    v-if="provider"
    :property-management-id="provider.id"
    :provider-name="provider.name"
  />
  <ApartmentTag
    v-for="tag in tags"
    :key="tag"
    :tag="tag"
  />
</template>
