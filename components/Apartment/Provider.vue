<script setup lang="ts">
defineProps<{
  propertyManagementId: string;
  providerName: string;
}>();
</script>

<template>
  <NuxtLink
    :to="`/overview?propertyManagements=${propertyManagementId}`"
    class="inline-flex items-center truncate rounded-full border border-main/20 px-2.5 py-0.25 text-xs font-medium text-main/60 transition-colors hover:border-accent/40 hover:text-accent"
  >
    {{ providerName }}
  </NuxtLink>
</template>
