<script lang="ts" setup>
import type { ListingCardProps } from "~/types/listing-flat";
import { formatArea, formatPrimaryRent } from "~/utils/util";

defineProps<ListingCardProps>();
</script>

<template>
  <div class="flex gap-3">
    <div class="h-full shrink-0">
      <NuxtLink
        :to="url"
        target="_blank"
      >
        <FlatImage
          :id="id"
          :has-image="hasImage"
          :alt="`Vorschaubild ${title}`"
        />
      </NuxtLink>
    </div>
    <div class="flex flex-col gap-1 overflow-hidden">
      <NuxtLink
        :to="url"
        target="_blank"
      >
        <h3
          class="overflow-hidden text-ellipsis whitespace-nowrap text-l leading-5"
        >
          {{ title }}
        </h3>
      </NuxtLink>
      <h4 class="overflow-hidden text-ellipsis text-s font-light">
        {{ address.street }} {{ address.streetNumber }} -
        <ApartmentDistrict
          class="hover:underline"
          :zip-code="address.postalCode"
        />
      </h4>
      <div class="flex flex-row flex-wrap items-center gap-1">
        <ApartmentProviderTags
          :property-management-id="propertyManagementId"
          :tags="tags"
        />
      </div>
    </div>
    <div class="flex shrink-0 flex-grow flex-col items-end gap-1">
      <span class="price block text-l font-light leading-5">{{
        formatPrimaryRent($props, true)
      }}</span>
      <span class="block text-s font-light">{{ formatArea(usableArea) }}</span>
      <ApartmentFavoriteButton :id="id" />
    </div>
  </div>
</template>
