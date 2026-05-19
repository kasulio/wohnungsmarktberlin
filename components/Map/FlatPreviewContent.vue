<script lang="ts" setup>
import type { MapFlat } from "~/types/map-flat";
import { formatArea, formatPrimaryRent, formatRoomCount } from "~/utils/util";

const props = defineProps<{
  flat: Pick<
    MapFlat,
    | "title"
    | "tags"
    | "roomCount"
    | "usableArea"
    | "warmRentPrice"
    | "coldRentPrice"
    | "propertyManagementId"
    | "address"
  >;
  districtLink?: boolean;
}>();
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <p class="line-clamp-2 text-s font-semibold leading-snug text-main">
      {{ flat.title }}
    </p>
    <div class="flex flex-wrap gap-1">
      <ApartmentProvider
        v-if="getProviderName(flat.propertyManagementId)"
        :property-management-id="flat.propertyManagementId!"
        :provider-name="getProviderName(flat.propertyManagementId)!"
      />
      <ApartmentTag
        v-for="tag in flat.tags"
        :key="tag"
        :tag="tag"
        class="py-0.25 rounded-full bg-secondary px-2.5 text-xs text-accent"
      />
    </div>
    <ul class="space-y-0.5 text-xs text-main/70">
      <li>
        {{ flat.address.street }}
        {{ flat.address.streetNumber }}
      </li>
      <li>
        <ApartmentDistrict
          :class="districtLink ? 'underline hover:no-underline' : undefined"
          :zip-code="flat.address.postalCode"
        />
      </li>
      <li class="flex gap-2">
        <span>{{ formatRoomCount(flat.roomCount) }} Zi.</span>
        <span>{{ formatArea(flat.usableArea) }}</span>
        <span class="font-semibold text-accent">
          {{ formatPrimaryRent(flat, true) }}
        </span>
      </li>
    </ul>
  </div>
</template>
