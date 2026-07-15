<script setup lang="ts">
import type { ListingCardDetailProps } from "~/types/listing-flat";

const config = useRuntimeConfig();
const pageDescription =
  "Alle aktuellen Mietwohnungen in Berlin auf einen Blick – filter nach Preis, Zimmeranzahl, Fläche und Bezirk. Angebote von öffentlichen Berliner Hausverwaltungen.";
useSeoMeta({
  title: "Alle Wohnungen",
  description: pageDescription,
  ogTitle: "Alle Mietwohnungen in Berlin | WohnungsMarktBerlin",
  ogDescription: pageDescription,
  ogUrl: `${config.public.deploymentUrl}/overview`,
  twitterTitle: "Alle Mietwohnungen in Berlin | WohnungsMarktBerlin",
  twitterDescription: pageDescription,
});
const { $client } = useNuxtApp();
const { urlState } = useFlatFilterUrlState();
const { registerLoadingRef, unregisterLoadingRef } =
  useCustomLoadingIndicator();

const flatsQuery = await $client.flat.getAll.useQuery(urlState);
const flats = flatsQuery.data ?? [];

// JSON-LD ItemList for top apartments (SSR, no filters applied)
useHead({
  script: [
    {
      type: "application/ld+json",
      innerHTML: computed(() => {
        const items = flatsQuery.data?.value?.data ?? [];
        return JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "Mietwohnungen in Berlin",
          description: pageDescription,
          url: `${config.public.deploymentUrl}/overview`,
          numberOfItems: items.length,
          itemListElement: items.slice(0, 20).map((flat, index) => ({
            "@type": "ListItem",
            position: index + 1,
            url: flat.url,
            name: flat.title,
          })),
        });
      }),
    },
  ],
});
onMounted(() => {
  registerLoadingRef(flatsQuery.status, (status) => status.value === "pending");
});

watch(flats, () => {
  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
});

onUnmounted(() => unregisterLoadingRef(flatsQuery.status));

const countText = computed(() => {
  const total = flatsQuery.data?.value?.totalElementsCount ?? 0;
  const filtered = flatsQuery.data?.value?.filteredElementsCount ?? 0;
  if (filtered === 0) {
    return "Keine Wohnungen";
  }
  if (filtered === total) {
    return `${total} Wohnungen`;
  }
  return `${filtered} von ${total} Wohnungen`;
});

const listingFlats = computed<ListingCardDetailProps[]>(() =>
  (flatsQuery.data?.value?.data ?? []).map((flat) => ({
    id: flat.id,
    title: flat.title,
    address: flat.address!,
    coldRentPrice: flat.coldRentPrice,
    warmRentPrice: flat.warmRentPrice,
    hasImage: flat.hasImage,
    tags: flat.tags,
    usableArea: flat.usableArea,
    url: flat.url,
    firstSeen: new Date(flat.firstSeen),
    roomCount: flat.roomCount,
    propertyManagementId: flat.propertyManagementId,
    floor: flat.floor,
  })),
);
</script>
<template>
  <div>
    <div class="mb-4 md:mb-6">
      <h1 class="text-xl leading-tight text-main">
        {{ countText }}
      </h1>
    </div>
    <Filters
      :result-count="flatsQuery.data?.value?.filteredElementsCount ?? null"
      :total-count="flatsQuery.data?.value?.totalElementsCount ?? null"
      :show-bar-count="false"
      show-sort
    />
    <div v-if="!listingFlats.length">
      <h2 class="mt-4 text-xl">
        Es wurden keine Wohnungen gefunden
        <span class="whitespace-nowrap">:(</span>
      </h2>
      <p class="mt-4 text-l text-accent">
        Versuche es mit anderen Filtern oder schau später nochmal vorbei!
      </p>
    </div>
    <div
      v-else
      class="mt-4"
    >
      <!-- mobile: accordion cards -->
      <div
        class="flex flex-col divide-y divide-black overflow-visible rounded-xl border border-black bg-white lg:hidden [&_article:first-child]:rounded-t-[0.75rem] [&_article:last-child]:rounded-b-[0.75rem]"
      >
        <ApartmentDetails
          v-for="flat in listingFlats"
          :id="flat.id"
          :key="flat.id"
          :room-count="flat.roomCount"
          :title="flat.title"
          :address="flat.address"
          :cold-rent-price="flat.coldRentPrice"
          :warm-rent-price="flat.warmRentPrice"
          :tags="flat.tags"
          :usable-area="flat.usableArea"
          :has-image="flat.hasImage"
          :url="flat.url"
          :first-seen="flat.firstSeen"
          :property-management-id="flat.propertyManagementId"
          :floor="flat.floor"
        />
      </div>

      <!-- desktop: master-detail list -->
      <div class="hidden lg:block">
        <ApartmentListingMasterDetail :flats="listingFlats" />
      </div>

      <div class="mt-8 w-full">
        <Pagination
          :total-elements-count="flats?.totalElementsCount ?? 0"
          :filtered-elements-count="flats?.filteredElementsCount ?? 0"
          :current-page="urlState.page ? urlState.page[0]! : 1"
          :page-size="urlState.pageSize ? urlState.pageSize[0]! : 25"
        />
      </div>
    </div>
  </div>
</template>
