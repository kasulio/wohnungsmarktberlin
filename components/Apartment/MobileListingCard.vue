<script lang="ts" setup>
import type { ListingCardDetailProps } from "~/types/listing-flat";
import { formatArea, formatPrice, formatRoomCount } from "~/utils/util";

const props = withDefaults(
  defineProps<
    ListingCardDetailProps & {
      mode?: "accordion" | "select";
      selected?: boolean;
    }
  >(),
  {
    propertyManagementId: null,
    floor: null,
    mode: "accordion",
    selected: false,
  },
);

const emit = defineEmits<{
  select: [];
}>();

const expanded = ref(false);
const panelId = useId();

const { districtLabel, summaryLabel } = useListingCardMeta(props);

const isOpen = computed(() =>
  props.mode === "select" ? props.selected : expanded.value,
);

function activate() {
  if (props.mode === "select") {
    emit("select");
    return;
  }
  expanded.value = !expanded.value;
}
</script>

<template>
  <article
    class="w-full"
    :class="[
      mode === 'select' && selected ? 'bg-slate-300' : 'bg-slate-200',
      expanded ? 'relative z-10 mb-10 overflow-visible' : 'overflow-hidden',
    ]"
  >
    <!-- collapsed row -->
    <div class="flex items-stretch gap-3 px-3 py-3">
      <NuxtLink
        :to="url"
        target="_blank"
        class="shrink-0 self-center"
        @click.stop
      >
        <FlatImage
          :id="id"
          :has-image="hasImage"
          :alt="`Vorschaubild ${title}`"
          class="size-[4.5rem] rounded-lg"
        />
      </NuxtLink>
      <div
        class="text-sm flex min-w-0 flex-1 cursor-pointer flex-col justify-between gap-2 leading-tight"
        :aria-expanded="isOpen"
        :aria-controls="mode === 'accordion' ? panelId : undefined"
        :aria-label="
          mode === 'select'
            ? `Wohnung ${summaryLabel} auswählen`
            : `Wohnung ${summaryLabel}, Details ${isOpen ? 'zuklappen' : 'aufklappen'}`
        "
        :role="mode === 'select' ? 'option' : undefined"
        :aria-selected="mode === 'select' ? selected : undefined"
        @click="activate"
      >
        <div class="grid grid-cols-2 gap-x-3 gap-y-1.5">
          <div class="flex min-w-0 items-center gap-1.5">
            <Icon
              name="lucide-lab:floor-plan"
              class="size-3.5 shrink-0 -scale-x-100 text-black"
            />
            <span class="truncate tabular-nums">
              {{ formatRoomCount(roomCount) }} Zimmer
            </span>
          </div>
          <div class="flex min-w-0 items-center gap-1.5">
            <Icon
              name="lucide:expand"
              class="size-3.5 shrink-0 text-black"
            />
            <span class="truncate tabular-nums">{{
              formatArea(usableArea)
            }}</span>
          </div>
          <div class="flex min-w-0 items-center gap-1.5">
            <Icon
              name="lucide:badge-minus"
              class="size-3.5 shrink-0 text-black"
              title="Kaltmiete"
            />
            <span class="truncate tabular-nums">{{
              formatPrice(coldRentPrice)
            }}</span>
          </div>
          <div class="flex min-w-0 items-center gap-1.5">
            <Icon
              name="lucide:badge-plus"
              class="size-3.5 shrink-0 text-black"
              title="Warmmiete"
            />
            <span class="truncate tabular-nums">{{
              formatPrice(warmRentPrice)
            }}</span>
          </div>
        </div>
        <p class="truncate text-xs leading-snug text-main/55">
          {{ address.street }}&nbsp;{{ address.streetNumber }},
          {{ address.postalCode }}&nbsp;{{ districtLabel }}
        </p>
      </div>
      <div class="flex shrink-0 items-center self-center">
        <button
          type="button"
          class="inline-flex size-6 shrink-0 items-center justify-center transition-transform duration-200"
          :class="isOpen ? 'rotate-0' : 'rotate-45'"
          :aria-expanded="isOpen"
          :aria-controls="mode === 'accordion' ? panelId : undefined"
          :aria-label="
            mode === 'select' ? 'Wohnung auswählen' : 'Details aufklappen'
          "
          @click="activate"
        >
          <LottieIcon
            src="/icons/cross.json"
            class="current-color block text-black"
            style="width: 24px; height: 24px"
          >
            <img
              src="/icons/cross.svg"
              alt=""
            />
          </LottieIcon>
        </button>
      </div>
    </div>

    <!-- expanded panel (accordion only) -->
    <div
      v-if="mode === 'accordion'"
      :id="panelId"
      class="grid transition-[grid-template-rows] duration-200 ease-out"
      :class="expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'"
    >
      <div
        class="min-h-0"
        :class="expanded ? 'overflow-visible' : 'overflow-hidden'"
      >
        <div
          class="relative border-t border-black/10 bg-white px-3 pb-10 pt-3"
          :inert="!expanded"
        >
          <ApartmentListingExpanded
            :id="id"
            :title="title"
            :address="address"
            :cold-rent-price="coldRentPrice"
            :warm-rent-price="warmRentPrice"
            :has-image="hasImage"
            :tags="tags"
            :usable-area="usableArea"
            :url="url"
            :first-seen="firstSeen"
            :room-count="roomCount"
            :property-management-id="propertyManagementId"
            :floor="floor"
          />
        </div>
      </div>
    </div>
  </article>
</template>
