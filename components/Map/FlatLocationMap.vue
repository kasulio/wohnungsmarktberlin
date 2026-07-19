<script lang="ts" setup>
import { GoogleMap } from "vue3-google-map";
import { berlinCoordinates } from "~/data/coordinates";
import type { ListingCardDetailProps } from "~/types/listing-flat";

type MapFlat = ListingCardDetailProps & {
  address: ListingCardDetailProps["address"] & {
    latitude: number;
    longitude: number;
  };
};

const props = defineProps<{
  flats: ListingCardDetailProps[];
  selectedId: string | null;
}>();

const emit = defineEmits<{
  select: [id: string];
}>();

const consent = useConsent();
const mapRef = ref<{
  ready: boolean;
  map: {
    panTo: (c: { lat: number; lng: number }) => void;
    setZoom: (z: number) => void;
  };
} | null>(null);

const mapFlats = computed((): MapFlat[] =>
  props.flats.filter(
    (flat): flat is MapFlat =>
      flat.address.latitude != null && flat.address.longitude != null,
  ),
);

const selectedFlat = computed(
  () => mapFlats.value.find((f) => f.id === props.selectedId) ?? null,
);

const center = computed(() =>
  selectedFlat.value
    ? {
        lat: selectedFlat.value.address.latitude,
        lng: selectedFlat.value.address.longitude,
      }
    : berlinCoordinates,
);

watch(
  [
    () => mapRef.value?.ready,
    () => selectedFlat.value?.id,
    () => selectedFlat.value?.address.latitude,
    () => selectedFlat.value?.address.longitude,
  ],
  ([ready]) => {
    if (!ready || !selectedFlat.value || !mapRef.value?.map) return;
    mapRef.value.map.panTo({
      lat: selectedFlat.value.address.latitude,
      lng: selectedFlat.value.address.longitude,
    });
    mapRef.value.map.setZoom(12);
  },
);
</script>

<template>
  <div
    class="h-full min-h-0 w-full overflow-hidden rounded-xl border border-black bg-white"
  >
    <ClientOnly>
      <template v-if="!consent.state?.value?.maps">
        <div class="flex h-full flex-col items-center justify-center gap-3 p-4">
          <p class="text-center text-xs text-main/60">
            Google Maps freigeben, um den Standort zu sehen.
          </p>
          <SimpleButton @click="consent.set({ maps: true })">
            Zustimmen
          </SimpleButton>
        </div>
      </template>
      <template v-else-if="!mapFlats.length">
        <div class="flex h-full items-center justify-center p-4">
          <p class="text-center text-xs text-main/55">
            Kein Standort verfügbar
          </p>
        </div>
      </template>
      <GoogleMap
        v-else
        ref="mapRef"
        class="h-full w-full"
        :center="center"
        :zoom="12"
        :api-key="$config.public.googleMapsApiKey"
        :map-id="$config.public.googleMapsId"
        :disable-default-ui="true"
        :gesture-handling="'cooperative'"
        :clickable-icons="false"
      >
        <MapFlatMarker
          v-for="flat in mapFlats"
          :key="flat.id"
          :flat="flat"
          :highlighted="flat.id === selectedId"
          @click="emit('select', flat.id)"
        />
      </GoogleMap>
    </ClientOnly>
  </div>
</template>
