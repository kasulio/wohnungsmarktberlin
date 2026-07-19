<script lang="ts" setup>
import type { ListingDetailsProps } from "~/types/listing-flat";

withDefaults(defineProps<ListingDetailsProps>(), {
  propertyManagementId: null,
  floor: null,
});
</script>

<template>
  <ApartmentMobileListingCard
    :id="id"
    :title="title"
    :address="address"
    :cold-rent-price="coldRentPrice"
    :warm-rent-price="warmRentPrice"
    :has-image="hasImage"
    :tags="tags"
    :usable-area="usableArea"
    :url="url"
    :first-seen="firstSeen"
    :room-count="roomCount"
    :property-management-id="propertyManagementId"
    :floor="floor"
  />
</template>
