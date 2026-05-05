<script lang="ts" setup>
import type { Tags } from "@/data/tags";
import { zipCodeToDistrict } from "~/data/districts";
import { formatArea, formatPrice } from "~/utils/util";

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
  }>(),
  { propertyManagementId: null, floor: null },
);

const providerName = computed(() =>
  getProviderName(props.propertyManagementId),
);

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

/** Treat 0 as unknown (scrapers / non-residential). */
const roomLabel = computed(() => {
  const n = props.roomCount;
  if (n == null || n === 0) {
    return "–";
  }
  return String(n);
});

const rentLabel = computed(() => {
  const c = props.coldRentPrice;
  const w = props.warmRentPrice;
  if (!c && !w) return "–";
  const fmt = (n: number) => n.toFixed(2).replace(".", ",");
  if (c && w) return `${fmt(c)}/${fmt(w)}\u00A0€`;
  return formatPrice(c ?? w);
});

const fmt = (n: number) => n.toFixed(2).replace(".", ",") + "\u00A0€";

const tableRows = computed(() => {
  const rows: { label: string; value: string }[] = [];
  const { street, streetNumber, postalCode } = props.address;
  const loc = district.value
    ? `${postalCode} ${district.value.name}`
    : postalCode;
  rows.push({ label: "Adresse", value: `${street} ${streetNumber}, ${loc}` });
  if (props.roomCount) rows.push({ label: "Zimmer", value: roomLabel.value });
  if (props.usableArea)
    rows.push({ label: "Fläche", value: formatArea(props.usableArea) });
  if (props.floor != null)
    rows.push({
      label: "Etage",
      value: props.floor === 0 ? "EG" : String(props.floor),
    });
  if (props.coldRentPrice)
    rows.push({ label: "Kaltmiete", value: fmt(props.coldRentPrice) });
  if (props.warmRentPrice)
    rows.push({ label: "Warmmiete", value: fmt(props.warmRentPrice) });
  if (props.warmRentPrice && props.usableArea)
    rows.push({
      label: "€/m²",
      value: fmt(props.warmRentPrice / props.usableArea),
    });
  rows.push({ label: "Gesehen am", value: firstSeenLabel.value });
  return rows;
});
</script>

<template>
  <article class="w-full overflow-hidden rounded-lg bg-slate-200">
    <!-- collapsed row -->
    <div class="flex items-center gap-1 px-2.5 py-2.5">
      <button
        type="button"
        class="text-sm min-w-0 flex-1 text-left leading-snug text-main outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary active:opacity-70"
        :aria-expanded="expanded"
        :aria-controls="panelId"
        :aria-label="`Wohnung ${summaryLabel}, Details ${expanded ? 'zuklappen' : 'aufklappen'}`"
        @click="toggleExpanded"
      >
        <span class="tabular-nums text-main">
          <span class="font-semibold">{{ roomLabel }}&thinsp;Zi.</span>
          &nbsp;|&nbsp;
          <span class="font-semibold">{{ formatArea(usableArea) }}</span>
          &nbsp;|&nbsp;
          <span class="font-semibold">{{ rentLabel }}</span>
        </span>
        <br />
        <span class="text-xs text-main/55">
          {{ address.street }}&nbsp;{{ address.streetNumber }},
          {{ address.postalCode
          }}<template v-if="district">&nbsp;{{ district.name }}</template>
        </span>
      </button>
      <div class="flex shrink-0 items-center gap-0.5">
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
            <NuxtLink
              :to="url"
              target="_blank"
              class="shrink-0 self-start overflow-hidden rounded-lg ring-1 ring-black/10"
            >
              <FlatImage
                :image-src="imageSrc"
                :alt="`Vorschaubild ${title}`"
                class="h-20 w-20 rounded-lg object-cover"
                :width="80"
                :height="80"
                sizes="80px"
              />
            </NuxtLink>
            <div class="min-w-0 flex-1">
              <!-- provider + tags + favorite -->
              <div class="mb-1.5 flex flex-wrap items-center gap-1.5">
                <ApartmentProvider
                  v-if="providerName"
                  :property-management-id="propertyManagementId!"
                  :provider-name="providerName"
                />
                <ApartmentTag
                  v-for="tag in tags"
                  :key="tag"
                  :tag="tag"
                  class="tag rounded-full bg-secondary px-2 py-0.5 text-xs text-accent"
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

          <StyledNuxtLink
            :to="url"
            no-underline
            class="text-sm inline-flex min-h-10 w-full items-center justify-center rounded-lg bg-accent px-3 font-medium text-white shadow-sm"
          >
            Zur Wohnung
          </StyledNuxtLink>
        </div>
      </div>
    </div>
  </article>
</template>
