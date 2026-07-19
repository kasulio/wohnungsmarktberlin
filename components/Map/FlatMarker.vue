<script lang="ts" setup>
import { CustomMarker } from "vue3-google-map";
import { formatPrimaryRent } from "~/utils/util";

defineProps<{
  flat: {
    id: string;
    coldRentPrice: number | null;
    warmRentPrice: number | null;
    address: { latitude: number; longitude: number };
  };
  highlighted: boolean;
}>();

const emit = defineEmits<{
  click: [MouseEvent];
  mouseenter: [MouseEvent];
  mouseout: [];
}>();
</script>

<template>
  <CustomMarker
    :options="{
      position: {
        lat: flat.address.latitude,
        lng: flat.address.longitude,
      },
      anchorPoint: 'BOTTOM_CENTER',
      zIndex: highlighted ? 10 : 1,
    }"
    @click="(event: MouseEvent) => emit('click', event)"
    @mouseover="(event: MouseEvent) => emit('mouseenter', event)"
    @mouseout="emit('mouseout')"
  >
    <div
      class="group flex cursor-pointer items-center justify-center transition-transform duration-100"
      :class="highlighted ? 'scale-105' : ''"
    >
      <div
        class="flex items-center gap-1 rounded-full border border-main px-2.5 py-1 shadow-sm transition-colors duration-100"
        :class="highlighted ? 'bg-accent' : 'bg-primary group-hover:bg-accent'"
      >
        <IconHome class="h-3 w-3 text-secondary" />
        <span class="text-xs font-semibold text-secondary">
          {{ formatPrimaryRent(flat, true) }}
        </span>
      </div>
    </div>
  </CustomMarker>
</template>
