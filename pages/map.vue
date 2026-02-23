<script setup lang="ts">
import { GoogleMap, CustomMarker, Polygon } from "vue3-google-map";
import resolveConfig from "tailwindcss/resolveConfig";
import tailwindConfig from "~/tailwind.config";
import { berlinCoordinates, ringbahnCoordinates } from "~/data/coordinates";

const { $client } = useNuxtApp();

const config = useRuntimeConfig();
const pageDescription =
  "Berliner Mietwohnungen auf der Karte – sieh auf einen Blick, wo günstige Wohnungen in deinem Wunschbezirk verfügbar sind.";
useSeoMeta({
  title: "Karte",
  description: pageDescription,
  ogTitle: "Wohnungskarte Berlin | WohnungsMarktBerlin",
  ogDescription: pageDescription,
  ogUrl: `${config.public.deploymentUrl}/map`,
  twitterTitle: "Wohnungskarte Berlin | WohnungsMarktBerlin",
  twitterDescription: pageDescription,
});
definePageMeta({
  pageTransition: {
    name: "rotate",
  },
});
const { theme } = resolveConfig(tailwindConfig);
const { urlState } = useFlatFilterUrlState();
const consent = useConsent();

const queryParams = computed(() => ({
  ...urlState.value,
  pageSize: [1000],
  page: [1],
}));

const flatsQuery = await $client.flat.getAll.useQuery(queryParams);

const flats = flatsQuery.data ?? {
  data: [],
};

type Flat = NonNullable<typeof flatsQuery.data.value>["data"][number];

const selectedFlat = ref<Flat | null>(null);
const tooltipPos = ref({ x: 0, y: 0 });
const mapContainer = ref<HTMLElement | null>(null);

// Detect touch/pointer device — set after mount to avoid SSR mismatch
const isTouch = ref(false);
onMounted(() => {
  isTouch.value = window.matchMedia("(pointer: coarse)").matches;
});

const TOOLTIP_OFFSET_X = 16;
const TOOLTIP_OFFSET_Y = -16;
const TOOLTIP_WIDTH = 220;
const TOOLTIP_HEIGHT = 240;

// Desktop: show on hover
function onMarkerMouseEnter(flat: Flat, event: MouseEvent) {
  if (isTouch.value) return;
  selectedFlat.value = flat;
  updateTooltipPos(event);
}

function onMarkerMouseLeave() {
  if (isTouch.value) return;
  selectedFlat.value = null;
}

function onMapMouseMove(event: MouseEvent) {
  if (isTouch.value || !selectedFlat.value) return;
  updateTooltipPos(event);
}

function updateTooltipPos(event: MouseEvent) {
  if (!mapContainer.value) return;
  const rect = mapContainer.value.getBoundingClientRect();
  let x = event.clientX - rect.left + TOOLTIP_OFFSET_X;
  let y = event.clientY - rect.top + TOOLTIP_OFFSET_Y;

  if (x + TOOLTIP_WIDTH > rect.width) {
    x = event.clientX - rect.left - TOOLTIP_WIDTH - TOOLTIP_OFFSET_X;
  }
  if (y + TOOLTIP_HEIGHT > rect.height) {
    y = rect.height - TOOLTIP_HEIGHT - 8;
  }
  if (y < 0) y = 8;

  tooltipPos.value = { x, y };
}

// Mobile: tap marker to select, tap map background or close button to dismiss
function onMarkerClick(flat: Flat, event: MouseEvent) {
  if (!isTouch.value) {
    // Desktop: navigate on click
    navigateTo(flat.url, { external: true, open: { target: "_blank" } });
    return;
  }
  // Touch: first tap selects, second tap on same marker navigates
  if (selectedFlat.value?.id === flat.id) {
    navigateTo(flat.url, { external: true, open: { target: "_blank" } });
  } else {
    selectedFlat.value = flat;
    event.stopPropagation();
  }
}

function dismissCard() {
  selectedFlat.value = null;
}
</script>

<template>
  <div class="flex h-full w-full flex-col">
    <h1 class="sr-only">Berliner Mietwohnungen auf der Karte</h1>
    <Filters />
    <div
      ref="mapContainer"
      class="relative h-full min-h-[70vh] grow overflow-hidden rounded-xl bg-background"
      @mousemove="onMapMouseMove"
      @click.self="dismissCard"
    >
      <ClientOnly>
        <GoogleMap
          v-if="consent.state?.value?.maps"
          class="h-full w-full"
          :center="berlinCoordinates"
          :zoom="11"
          :api-key="$config.public.googleMapsApiKey"
          :map-id="$config.public.googleMapsId"
        >
          <Polygon
            :options="{
              paths: ringbahnCoordinates,
              fillColor: theme.colors.accent,
              fillOpacity: 0,
              strokeColor: theme.colors.primary,
            }"
          />
          <CustomMarker
            v-for="flat in flats?.data"
            :key="flat.id"
            :options="{
              position: {
                lat: flat.address.latitude!,
                lng: flat.address.longitude!,
              },
              anchorPoint: 'BOTTOM_CENTER',
              zIndex: selectedFlat?.id === flat.id ? 10 : 1,
            }"
            @click="(e: MouseEvent) => onMarkerClick(flat, e)"
            @mouseover="(e: MouseEvent) => onMarkerMouseEnter(flat, e)"
            @mouseout="onMarkerMouseLeave"
          >
            <div
              class="group flex cursor-pointer items-center justify-center"
              :class="selectedFlat?.id === flat.id ? 'scale-105' : ''"
            >
              <div
                class="flex items-center gap-1 rounded-full border border-main bg-primary px-2.5 py-1 shadow-sm transition-colors duration-100 group-hover:bg-accent"
                :class="selectedFlat?.id === flat.id ? 'bg-accent' : ''"
              >
                <IconHome class="h-3 w-3 text-secondary" />
                <span class="text-xs font-semibold text-secondary">
                  {{ flat.warmRentPrice ?? flat.coldRentPrice }}€
                </span>
              </div>
            </div>
          </CustomMarker>
        </GoogleMap>
        <div
          v-else
          class="flex h-full w-full flex-col items-center justify-center gap-4 p-8"
        >
          <p class="text-center">
            Um die Karte zu sehen, musst du der Nutzung von Google Maps
            zustimmen.
          </p>
          <SimpleButton @click="consent.set({ maps: true })">
            Zustimmen
          </SimpleButton>
        </div>
      </ClientOnly>

      <!-- Desktop: cursor-following tooltip -->
      <Transition
        enter-active-class="transition-opacity duration-100"
        leave-active-class="transition-opacity duration-100"
        enter-from-class="opacity-0"
        leave-to-class="opacity-0"
      >
        <div
          v-if="selectedFlat && !isTouch"
          class="pointer-events-none absolute z-50 w-[220px] overflow-hidden rounded-m border border-main bg-white shadow-md"
          :style="{ left: `${tooltipPos.x}px`, top: `${tooltipPos.y}px` }"
        >
          <FlatImage
            :image-src="getFlatImageUrl(selectedFlat)"
            :alt="selectedFlat.title"
            class="h-32 w-full rounded-none object-cover"
            :width="220"
            :height="128"
          />
          <div class="flex flex-col gap-1.5 p-3">
            <p class="line-clamp-2 text-s font-semibold leading-snug text-main">
              {{ selectedFlat.title }}
            </p>
            <div class="flex flex-wrap gap-1">
              <ApartmentProvider
                v-if="getProviderName(selectedFlat.propertyManagementId)"
                :property-management-id="selectedFlat.propertyManagementId!"
                :provider-name="
                  getProviderName(selectedFlat.propertyManagementId)!
                "
              />
              <ApartmentTag
                v-for="tag in selectedFlat.tags"
                :key="tag"
                :tag="tag"
                class="py-0.25 rounded-full bg-secondary px-2.5 text-xs text-accent"
              />
            </div>
            <ul class="space-y-0.5 text-xs text-main/70">
              <li>
                {{ selectedFlat.address.street }}
                {{ selectedFlat.address.streetNumber }}
              </li>
              <li>
                <ApartmentDistrict
                  class="underline hover:no-underline"
                  :zip-code="selectedFlat.address.postalCode"
                />
              </li>
              <li class="flex gap-2">
                <span>{{ selectedFlat.roomCount }} Zi.</span>
                <span>{{ selectedFlat.usableArea }} m²</span>
                <span class="font-semibold text-accent">
                  {{
                    selectedFlat.warmRentPrice ?? selectedFlat.coldRentPrice
                  }}€
                </span>
              </li>
            </ul>
          </div>
        </div>
      </Transition>

      <!-- Mobile: bottom card -->
      <Transition
        enter-active-class="transition-transform duration-200 ease-out"
        leave-active-class="transition-transform duration-150 ease-in"
        enter-from-class="translate-y-full"
        leave-to-class="translate-y-full"
      >
        <div
          v-if="selectedFlat && isTouch"
          class="absolute inset-x-3 bottom-3 z-50 overflow-hidden rounded-m border border-main bg-white shadow-md"
        >
          <button
            class="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-main bg-white text-main"
            aria-label="Schließen"
            @click.stop="dismissCard"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              class="h-4 w-4"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
          <a
            :href="selectedFlat.url"
            target="_blank"
            rel="noopener noreferrer"
            class="flex gap-3"
            @click.stop
          >
            <FlatImage
              :image-src="getFlatImageUrl(selectedFlat)"
              :alt="selectedFlat.title"
              class="w-28 shrink-0 self-stretch rounded-none object-cover object-center"
              :width="112"
              :height="112"
            />
            <div
              class="flex min-w-0 flex-col justify-center gap-1.5 py-3 pr-10"
            >
              <p
                class="line-clamp-2 text-s font-semibold leading-snug text-main"
              >
                {{ selectedFlat.title }}
              </p>
              <div class="flex flex-wrap gap-1">
                <ApartmentProvider
                  v-if="getProviderName(selectedFlat.propertyManagementId)"
                  :property-management-id="selectedFlat.propertyManagementId!"
                  :provider-name="
                    getProviderName(selectedFlat.propertyManagementId)!
                  "
                />
                <ApartmentTag
                  v-for="tag in selectedFlat.tags"
                  :key="tag"
                  :tag="tag"
                  class="py-0.25 rounded-full bg-secondary px-2.5 text-xs text-accent"
                />
              </div>
              <ul class="space-y-0.5 text-xs text-main/70">
                <li>
                  {{ selectedFlat.address.street }}
                  {{ selectedFlat.address.streetNumber }}
                </li>
                <li>
                  <ApartmentDistrict
                    :zip-code="selectedFlat.address.postalCode"
                  />
                </li>
                <li class="flex gap-2">
                  <span>{{ selectedFlat.roomCount }} Zi.</span>
                  <span>{{ selectedFlat.usableArea }} m²</span>
                  <span class="font-semibold text-accent">
                    {{
                      selectedFlat.warmRentPrice ?? selectedFlat.coldRentPrice
                    }}€
                  </span>
                </li>
              </ul>
            </div>
          </a>
        </div>
      </Transition>
    </div>
  </div>
</template>
