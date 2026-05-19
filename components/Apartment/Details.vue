<script lang="ts" setup>
import type { Tags } from "@/data/tags";
import {
  formatArea,
  formatPrimaryRent,
  formatRoomCount,
  primaryRentPrice,
} from "~/utils/util";

const props = withDefaults(
  defineProps<{
    id: string;
    title: string;
    address: {
      street: string;
      postalCode: string;
      streetNumber: string;
    };
    coldRentPrice: number | null;
    warmRentPrice: number | null;
    imageSrc: string | null;
    tags: Tags;
    usableArea: number | null;
    url: string;
    firstSeen: Date;
    roomCount: number | null;
    propertyManagementId?: string | null;
    floor?: number | null;
    as?: "row" | "card";
  }>(),
  {
    as: "card",
    propertyManagementId: null,
    floor: null,
  },
);

const primaryRent = computed(() =>
  primaryRentPrice({
    warmRentPrice: props.warmRentPrice,
    coldRentPrice: props.coldRentPrice,
  }),
);
const providerName = computed(() =>
  getProviderName(props.propertyManagementId),
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
            :image-src="imageSrc"
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
            <ApartmentProvider
              v-if="providerName"
              :property-management-id="propertyManagementId!"
              :provider-name="providerName"
            />
            <ApartmentTag
              v-for="tag in tags"
              :key="tag"
              :tag="tag"
              class="tag py-0.25 rounded-full bg-secondary px-2.5 text-xs text-accent"
            >
            </ApartmentTag>
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
    :image-src="imageSrc"
    :tags="tags"
    :usable-area="usableArea"
    :url="url"
    :first-seen="firstSeen"
    :room-count="roomCount"
    :property-management-id="propertyManagementId"
    :floor="floor"
  />
</template>
