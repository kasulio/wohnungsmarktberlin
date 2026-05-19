<script lang="ts" setup>
import { zipCodeToDistrict } from "~/data/districts";
import type { ListingCardDetailProps } from "~/types/listing-flat";
import { formatArea, formatPrice, formatRoomCount } from "~/utils/util";

const props = withDefaults(defineProps<ListingCardDetailProps>(), {
  propertyManagementId: null,
  floor: null,
});

const expanded = ref(false);
const panelId = useId();

const district = computed(
  () => zipCodeToDistrict[props.address.postalCode] ?? null,
);

const firstSeenLabel = computed(() =>
  props.firstSeen.toLocaleDateString("de-DE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }),
);

function toggleExpanded() {
  expanded.value = !expanded.value;
}

const summaryLabel = computed(() => {
  const plz = props.address.postalCode;
  const loc = district.value ? `${plz} ${district.value.name}` : plz;
  return `${props.address.street} ${props.address.streetNumber}, ${loc}`;
});

const route = useRoute();

const mapTo = computed(() => ({
  path: "/map",
  query: {
    ...route.query,
    flat: props.id,
  },
}));

const tableRows = computed(() => {
  const rows: { label: string; value: string }[] = [];
  const { street, streetNumber, postalCode } = props.address;
  const loc = district.value
    ? `${postalCode} ${district.value.name}`
    : postalCode;
  rows.push({ label: "Adresse", value: `${street} ${streetNumber}, ${loc}` });
  if (props.roomCount)
    rows.push({ label: "Zimmer", value: formatRoomCount(props.roomCount) });
  if (props.usableArea)
    rows.push({ label: "Fläche", value: formatArea(props.usableArea) });
  if (props.floor != null)
    rows.push({
      label: "Etage",
      value: props.floor === 0 ? "EG" : String(props.floor),
    });
  if (props.coldRentPrice)
    rows.push({ label: "Kaltmiete", value: formatPrice(props.coldRentPrice) });
  if (props.warmRentPrice)
    rows.push({ label: "Warmmiete", value: formatPrice(props.warmRentPrice) });
  if ((props.coldRentPrice || props.warmRentPrice) && props.usableArea)
    rows.push({
      label: "€/m²",
      value: `${props.coldRentPrice ? formatPrice(props.coldRentPrice / props.usableArea) : "-"} / ${props.warmRentPrice ? formatPrice(props.warmRentPrice / props.usableArea) : "-"}`,
    });
  rows.push({ label: "Gesehen am", value: firstSeenLabel.value });
  return rows;
});
</script>

<template>
  <article class="w-full overflow-hidden rounded-lg bg-slate-200">
    <!-- collapsed row -->
    <div class="flex items-stretch gap-2.5 px-2.5 py-2.5">
      <NuxtLink
        :to="url"
        target="_blank"
        class="shrink-0 self-center"
      >
        <FlatImage
          :id="id"
          :has-image="hasImage"
          :alt="`Vorschaubild ${title}`"
          class="size-[4.5rem] rounded-lg"
        />
      </NuxtLink>
      <div
        class="text-sm flex min-w-0 flex-1 cursor-pointer flex-col justify-between leading-tight"
        :aria-expanded="expanded"
        :aria-controls="panelId"
        :aria-label="`Wohnung ${summaryLabel}, Details ${expanded ? 'zuklappen' : 'aufklappen'}`"
        @click="toggleExpanded"
      >
        <div class="grid grid-cols-2 gap-x-3 gap-y-1.5">
          <div class="flex min-w-0 items-center gap-1.5">
            <Icon
              name="lucide-lab:floor-plan"
              class="size-3.5 shrink-0 -scale-x-100 text-main/45"
            />
            <span class="truncate tabular-nums">
              {{ formatRoomCount(roomCount) }} Zimmer
            </span>
          </div>
          <div class="flex min-w-0 items-center gap-1.5">
            <Icon
              name="lucide:expand"
              class="size-3.5 shrink-0 text-main/45"
            />
            <span class="truncate tabular-nums">{{
              formatArea(usableArea)
            }}</span>
          </div>
          <div class="flex min-w-0 items-center gap-1.5">
            <Icon
              name="lucide:badge-minus"
              class="size-3.5 shrink-0 text-main/45"
              title="Kaltmiete"
            />
            <span class="truncate tabular-nums">{{
              formatPrice(coldRentPrice)
            }}</span>
          </div>
          <div class="flex min-w-0 items-center gap-1.5">
            <Icon
              name="lucide:badge-plus"
              class="size-3.5 shrink-0 text-main/45"
              title="Warmmiete"
            />
            <span class="truncate tabular-nums">{{
              formatPrice(warmRentPrice)
            }}</span>
          </div>
        </div>
        <p class="truncate text-xs leading-snug text-main/55">
          {{ address.street }}&nbsp;{{ address.streetNumber }},
          {{ address.postalCode
          }}<template v-if="district">&nbsp;{{ district.name }}</template>
        </p>
      </div>
      <div class="flex shrink-0 items-center gap-0.5 self-center">
        <button
          type="button"
          class="grid h-7 w-7 place-items-center rounded text-main/50 transition-transform"
          :class="expanded ? 'rotate-0' : 'rotate-45'"
          :aria-expanded="expanded"
          :aria-controls="panelId"
          aria-label="Details aufklappen"
          @click="toggleExpanded"
        >
          <IconCross />
        </button>
      </div>
    </div>

    <!-- expanded panel -->
    <div
      :id="panelId"
      class="grid transition-[grid-template-rows] duration-200 ease-out"
      :class="expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'"
    >
      <div class="min-h-0 overflow-hidden">
        <div
          class="space-y-3 border-t border-black/10 bg-background/90 px-2.5 pb-3 pt-3"
          :inert="!expanded"
        >
          <!-- image + [provider + tags + title] -->
          <div class="flex gap-3">
            <div class="min-w-0 flex-1">
              <!-- provider + tags + favorite -->
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
              <!-- title -->
              <NuxtLink
                :to="url"
                target="_blank"
                class="text-sm font-medium leading-snug text-main underline-offset-2 hover:underline"
              >
                <span class="line-clamp-3">{{ title }}</span>
              </NuxtLink>
            </div>
          </div>

          <!-- info table -->
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

          <div class="grid grid-cols-2 gap-2">
            <StyledNuxtLink
              :to="mapTo"
              target="_blank"
              no-underline
              class="text-sm inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-main/20 bg-background px-3 font-medium text-main shadow-sm"
              @click.stop
            >
              Zur Karte
              <Icon
                name="lucide:map"
                class="size-4 shrink-0"
              />
            </StyledNuxtLink>
            <StyledNuxtLink
              :to="url"
              no-underline
              class="text-sm inline-flex min-h-10 items-center justify-center rounded-lg bg-accent px-3 font-medium text-white shadow-sm"
              @click.stop
            >
              Zur Wohnung
            </StyledNuxtLink>
          </div>
        </div>
      </div>
    </div>
  </article>
</template>
