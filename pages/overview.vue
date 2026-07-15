<script setup lang="ts">
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
const { urlState, updateQueryState } = useFlatFilterUrlState();
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

const sortOptions = flatFilterUrlSchema.shape.orderBy.unwrap().unwrap()
  .element.options;

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

const tableHeaders = computed(
  () =>
    ({
      main: {
        title: countText.value,
        class: "w-[30%] rounded-l-xl px-4 text-left",
      },
      coldRentPrice: {
        title: "Kalt",
      },
      warmRentPrice: {
        title: "Warm",
      },
      roomCount: {
        title: "Zi.",
        class: "w-[8%]",
      },
      usableArea: {
        title: "m²",
      },
      rentPricePerSquareMeter: {
        title: "€/m²",
      },
      district: {
        title: "Bezirk",
        class: "w-[16%]",
      },
      favorite: {
        title: "",
        class: "w-[5%]",
      },
    }) as Record<string, { title: string; class?: string }>,
);

const sortOrders = computed(() => {
  return Object.entries(tableHeaders.value).reduce(
    (acc, [key]) => {
      if (!urlState.value.orderBy?.[0] && key === "main") {
        return {
          ...acc,
          [key]: urlState.value.order?.[0] ?? "desc",
        };
      }

      return {
        ...acc,
        [key]:
          urlState.value.orderBy?.[0] === key
            ? urlState.value.order?.[0]
            : undefined,
      };
    },
    {} as Record<string, "asc" | "desc" | undefined>,
  );
});
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
    <div v-if="!flats?.data?.length">
      <h2 class="mt-4 text-xl">
        Es wurden keine Wohnungen gefunden
        <span class="whitespace-nowrap">:(</span>
      </h2>
      <p class="mt-4 text-l text-accent">
        Versuche es mit anderen Filtern oder schau später nochmal vorbei!
      </p>
    </div>
    <div v-else>
      <table
        class="hidden w-full table-fixed border-separate border-spacing-y-4 text-center lg:table"
      >
        <thead class="bg-background">
          <tr>
            <th
              v-for="[headerKey, header] in Object.entries(tableHeaders)"
              :key="headerKey"
              class="text-nowrap px-2 py-4 font-medium first:rounded-l-xl last:rounded-r-xl"
              :class="header.class"
            >
              <button
                v-if="sortOptions.includes(headerKey) || headerKey === 'main'"
                class="group m-auto flex items-center gap-1"
                @click="
                  () => {
                    updateQueryState({
                      orderBy: [headerKey as (typeof sortOptions)[number]],
                      order: [sortOrders[headerKey] === 'asc' ? 'desc' : 'asc'],
                    });
                  }
                "
                @mouseenter="
                  (e) => {
                    // @ts-ignore
                    const icon = e.target?.querySelector('lord-icon');
                    if (icon.playerInstance) {
                      !icon.playerInstance.isPlaying &&
                        icon.playerInstance.playFromBeginning();
                    }
                  }
                "
              >
                {{ header.title }}
                <lord-icon
                  icon="arrow"
                  src="/icons/arrow.json"
                  state="hover-ternd-flat-3"
                  class="-mr-[20px] -rotate-90 transition-all duration-500"
                  :class="{
                    'opacity-0': sortOrders[headerKey] === undefined,
                    'group-hover:opacity-50':
                      sortOrders[headerKey] === undefined,
                    '-scale-x-100': sortOrders[headerKey] === 'desc',
                  }"
                  style="width: 20px; height: 20px"
                />
              </button>
              <div v-else>
                {{ header.title }}
              </div>
            </th>
          </tr>
        </thead>
        <tbody class="text-center">
          <ApartmentDetails
            v-for="flat in flats?.data"
            :id="flat.id"
            :key="flat.id"
            :room-count="flat.roomCount"
            as="row"
            :title="flat.title"
            :address="flat.address!"
            :cold-rent-price="flat.coldRentPrice"
            :warm-rent-price="flat.warmRentPrice"
            :tags="flat.tags"
            :favorite="false"
            :usable-area="flat.usableArea"
            :has-image="flat.hasImage"
            :url="flat.url"
            :first-seen="new Date(flat.firstSeen)"
            :property-management-id="flat.propertyManagementId"
            :floor="flat.floor"
          />
        </tbody>
      </table>

      <div class="lg:hidden">
        <div class="flex flex-col gap-3">
          <ApartmentDetails
            v-for="flat in flats?.data"
            :id="flat.id"
            :key="flat.id"
            :room-count="flat.roomCount"
            :title="flat.title"
            :address="flat.address!"
            :cold-rent-price="flat.coldRentPrice"
            :warm-rent-price="flat.warmRentPrice"
            :tags="flat.tags"
            :favorite="false"
            :usable-area="flat.usableArea"
            :has-image="flat.hasImage"
            :url="flat.url"
            :first-seen="new Date(flat.firstSeen)"
            :property-management-id="flat.propertyManagementId"
            :floor="flat.floor"
          />
        </div>
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
