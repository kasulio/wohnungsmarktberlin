<script setup lang="ts">
import { GoogleMap, Marker, InfoWindow, Polygon } from "vue3-google-map";
import resolveConfig from "tailwindcss/resolveConfig";
import tailwindConfig from "~/tailwind.config";
import { berlinCoordinates, ringbahnCoordinates } from "~/data/coordinates";

const { $client } = useNuxtApp();

useHead({
  title: "Karte",
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

const infoWindowsOpen = ref<Record<string, boolean>>({});
</script>
<template>
  <div class="flex h-full w-full flex-col">
    <Filters />
    <div
      class="h-full min-h-[70vh] grow overflow-hidden rounded-xl bg-background"
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
              fillOpacity: 0.2,
              strokeColor: theme.colors.primary,
            }"
          />
          <Marker
            v-for="flat in flats?.data"
            :key="flat.id"
            :options="{
              position: {
                lat: flat.address.latitude,
                lng: flat.address.longitude,
              },
              icon: {
                url: `${$config.public.deploymentUrl}/marker.svg?v=1.0`,
                scaledSize: {
                  width: 32,
                  height: 32,
                },
              },
            }"
            @click="
              () =>
                navigateTo(flat.url, {
                  external: true,
                  open: {
                    target: '_blank',
                  },
                })
            "
            @mouseover="() => (infoWindowsOpen[flat.id] = true)"
            @mouseout="() => (infoWindowsOpen[flat.id] = false)"
          >
            <InfoWindow :model-value="infoWindowsOpen[flat.id]">
              <div class="flex w-40 flex-col gap-4 p-2">
                <FlatImage
                  v-if="infoWindowsOpen[flat.id]"
                  :flat="flat"
                  :alt="flat.title"
                  class="aspect-square h-32 w-32 rounded-md"
                  :width="128"
                  :height="128"
                />
                <div class="break-words font-bold">
                  {{ flat.title }}
                </div>
                <ul>
                  <li>
                    {{ flat.address.street }} {{ flat.address.streetNumber }}
                  </li>
                  <li>
                    <ApartmentDistrict
                      class="underline hover:no-underline"
                      :zip-code="flat.address.postalCode"
                    />
                  </li>
                  <li>{{ flat.roomCount }} Zimmer</li>
                  <li>{{ flat.usableArea }} m²</li>
                  <li>{{ flat.warmRentPrice ?? flat.coldRentPrice }} €</li>
                </ul>
              </div>
            </InfoWindow>
          </Marker>
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
    </div>
  </div>
</template>
