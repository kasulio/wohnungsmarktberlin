<script lang="ts" setup>
import type { ListingCardDetailProps } from "~/types/listing-flat";

const props = defineProps<{
  flats: ListingCardDetailProps[];
}>();

const selectedId = ref<string | null>(null);
const listEl = ref<HTMLElement | null>(null);

const selectedFlat = computed(
  () => props.flats.find((f) => f.id === selectedId.value) ?? null,
);

watch(
  () => props.flats,
  (flats) => {
    if (!flats.length) {
      selectedId.value = null;
      return;
    }
    if (!selectedId.value || !flats.some((f) => f.id === selectedId.value)) {
      selectedId.value = flats[0]!.id;
    }
  },
  { immediate: true },
);

function selectFlat(id: string) {
  selectedId.value = id;
}

function selectFlatFromMap(id: string) {
  selectedId.value = id;
  nextTick(() => {
    listEl.value
      ?.querySelector(`[data-flat-id="${CSS.escape(id)}"]`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  });
}
</script>

<template>
  <div class="flex h-[min(70vh,52rem)] items-stretch gap-4">
    <ul
      ref="listEl"
      class="flex min-h-0 min-w-0 flex-1 flex-col divide-y divide-black overflow-y-auto overflow-x-hidden rounded-xl border border-black bg-white [scrollbar-color:rgba(0,0,0,0.12)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-black/10 hover:[&::-webkit-scrollbar-thumb]:bg-black/20 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-1"
      role="listbox"
      aria-label="Wohnungsliste"
    >
      <li
        v-for="flat in flats"
        :key="flat.id"
        :data-flat-id="flat.id"
      >
        <ApartmentMobileListingCard
          :id="flat.id"
          mode="select"
          :selected="flat.id === selectedId"
          :title="flat.title"
          :address="flat.address"
          :cold-rent-price="flat.coldRentPrice"
          :warm-rent-price="flat.warmRentPrice"
          :has-image="flat.hasImage"
          :tags="flat.tags"
          :usable-area="flat.usableArea"
          :url="flat.url"
          :first-seen="flat.firstSeen"
          :room-count="flat.roomCount"
          :property-management-id="flat.propertyManagementId"
          :floor="flat.floor"
          @select="selectFlat(flat.id)"
        />
      </li>
    </ul>

    <aside
      class="flex min-h-0 min-w-0 flex-1 flex-col"
      aria-live="polite"
    >
      <div
        class="relative shrink-0 rounded-xl border border-black bg-white p-4 pb-14"
      >
        <template v-if="selectedFlat">
          <ApartmentListingExpanded
            :key="selectedFlat.id"
            :id="selectedFlat.id"
            :title="selectedFlat.title"
            :address="selectedFlat.address"
            :cold-rent-price="selectedFlat.coldRentPrice"
            :warm-rent-price="selectedFlat.warmRentPrice"
            :has-image="selectedFlat.hasImage"
            :tags="selectedFlat.tags"
            :usable-area="selectedFlat.usableArea"
            :url="selectedFlat.url"
            :first-seen="selectedFlat.firstSeen"
            :room-count="selectedFlat.roomCount"
            :property-management-id="selectedFlat.propertyManagementId"
            :floor="selectedFlat.floor"
          />
        </template>
        <p
          v-else
          class="text-sm text-main/55"
        >
          Wohnung auswählen
        </p>
      </div>

      <MapFlatLocationMap
        v-if="selectedFlat"
        class="mt-10 min-h-0 flex-1"
        :flats="flats"
        :selected-id="selectedId"
        @select="selectFlatFromMap"
      />
    </aside>
  </div>
</template>
