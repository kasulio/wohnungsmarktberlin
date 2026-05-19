<script lang="ts" setup>
import type { ListingDetailsProps } from "~/types/listing-flat";
import {
  formatArea,
  formatPrimaryRent,
  formatRoomCount,
  primaryRentPrice,
} from "~/utils/util";

const props = withDefaults(defineProps<ListingDetailsProps>(), {
  as: "card",
  propertyManagementId: null,
  floor: null,
});

const primaryRent = computed(() =>
  primaryRentPrice({
    warmRentPrice: props.warmRentPrice,
    coldRentPrice: props.coldRentPrice,
  }),
);
</script>

<template>
  <tr
    v-if="Boolean(as === 'row')"
    class="text-m font-light leading-5"
  >
    <td class="items-top flex gap-x-2">
      <div class="aspect-square h-full shrink-0">
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
      <div class="max-w-80 overflow-hidden align-top">
        <NuxtLink
          :to="url"
          target="_blank"
        >
          <h3
            class="overflow-hidden text-ellipsis whitespace-nowrap text-left font-normal"
          >
            {{ title }}
          </h3>
        </NuxtLink>
        <div class="flex flex-col gap-x-3 text-left">
          <h4 class="overflow-hidden text-ellipsis text-s font-light">
            {{ address.street }} {{ address.streetNumber }}
          </h4>
          <div
            class="mt-1 flex flex-row flex-wrap items-center gap-x-1 gap-y-1"
          >
            <ApartmentProviderTags
              :property-management-id="propertyManagementId"
              :tags="tags"
            />
          </div>
        </div>
      </div>
    </td>
    <td class="align-top">
      <span>{{ formatPrimaryRent($props) }}</span>
      <span
        v-if="$props.warmRentPrice"
        class="block text-s opacity-80"
        >Warmmiete</span
      >
    </td>
    <td class="align-top">
      {{ formatRoomCount(roomCount) }}
    </td>
    <td class="align-top">
      {{ formatArea(usableArea) }}
    </td>
    <td
      v-if="primaryRent"
      class="align-top"
    >
      {{
        usableArea
          ? (primaryRent / usableArea).toFixed(2).replace(".", ",") + "\u00A0€"
          : "-"
      }}
    </td>
    <td
      v-else
      class="align-top"
    >
      -
    </td>
    <td class="break-words align-top">
      <ApartmentDistrict
        class="underline hover:no-underline"
        :zip-code="address.postalCode"
      />
    </td>
    <td class="px-2 align-top">
      <ApartmentFavoriteButton :id="id" />
    </td>
  </tr>

  <!---------- MOBILE ------------>
  <ApartmentMobileListingCard
    v-else
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
