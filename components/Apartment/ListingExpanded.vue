<script lang="ts" setup>
import type { ListingCardDetailProps } from "~/types/listing-flat";

const props = withDefaults(defineProps<ListingCardDetailProps>(), {
  propertyManagementId: null,
  floor: null,
});

const { tableRows, mapTo } = useListingCardMeta(props);
</script>

<template>
  <div class="space-y-3">
    <div class="min-w-0 flex-1">
      <div class="mb-1.5 flex flex-wrap items-center gap-1.5">
        <ApartmentProviderTags
          :property-management-id="propertyManagementId"
          :tags="tags"
        />
        <ApartmentFavoriteButton
          :id="id"
          class="ml-auto"
        />
      </div>
      <NuxtLink
        :to="url"
        target="_blank"
        class="text-sm font-medium leading-snug text-main underline-offset-2 hover:underline"
      >
        <span class="line-clamp-3">{{ title }}</span>
      </NuxtLink>
    </div>

    <table class="w-full text-xs">
      <tbody>
        <tr
          v-for="row in tableRows"
          :key="row.label"
          class="border-b border-black/5 last:border-0"
        >
          <td class="w-px whitespace-nowrap py-1 pr-3 text-main/50">
            {{ row.label }}
          </td>
          <td class="py-1 tabular-nums text-main">{{ row.value }}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div
    class="absolute -bottom-5 left-6 right-4 z-10 flex gap-4 md:left-6 md:right-2 md:gap-6"
  >
    <FatButton
      variant="secondary"
      class="min-w-0 flex-shrink basis-2/5"
      :href="mapTo"
      target="_blank"
      @click.stop
    >
      Zur Karte
      <Icon
        name="lucide:map"
        class="size-5 shrink-0"
      />
    </FatButton>
    <FatButton
      class="min-w-0 flex-1"
      :href="url"
      target="_blank"
      @click.stop
    >
      Zur Wohnung
      <img
        src="/arrow_right.svg"
        width="32"
        height="23"
        aria-hidden="true"
        class="ml-1 inline h-4 w-auto shrink-0 md:ml-2 md:h-[1.4375rem]"
      />
    </FatButton>
  </div>
</template>
