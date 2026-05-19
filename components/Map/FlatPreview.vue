<script lang="ts" setup>
import type { ListingFlat } from "~/types/listing-flat";

defineProps<{
  flat: ListingFlat;
  variant: "tooltip" | "card";
  position?: { x: number; y: number };
}>();

const emit = defineEmits<{
  dismiss: [];
}>();
</script>

<template>
  <Transition
    :enter-active-class="
      variant === 'tooltip'
        ? 'transition-opacity duration-100'
        : 'transition-transform duration-200 ease-out'
    "
    :leave-active-class="
      variant === 'tooltip'
        ? 'transition-opacity duration-100'
        : 'transition-transform duration-150 ease-in'
    "
    :enter-from-class="variant === 'tooltip' ? 'opacity-0' : 'translate-y-full'"
    :leave-to-class="variant === 'tooltip' ? 'opacity-0' : 'translate-y-full'"
  >
    <div
      v-if="variant === 'tooltip'"
      class="pointer-events-none absolute z-50 w-[220px] overflow-hidden rounded-m border border-main bg-white shadow-md"
      :style="
        position
          ? { left: `${position.x}px`, top: `${position.y}px` }
          : undefined
      "
    >
      <FlatImage
        :id="flat.id"
        :has-image="flat.hasImage"
        :alt="flat.title"
        class="h-32 w-full rounded-none object-cover"
        :width="220"
        :height="128"
      />
      <div class="p-3">
        <MapFlatPreviewContent
          :flat="flat"
          district-link
        />
      </div>
    </div>

    <div
      v-else
      class="absolute inset-x-3 bottom-3 z-50 overflow-hidden rounded-m border border-main bg-white shadow-md"
    >
      <button
        class="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-main bg-white text-main"
        aria-label="Schließen"
        @click.stop="emit('dismiss')"
      >
        <Icon
          name="lucide:x"
          class="size-4"
        />
      </button>
      <a
        :href="flat.url"
        target="_blank"
        rel="noopener noreferrer"
        class="flex gap-3"
        @click.stop
      >
        <FlatImage
          :id="flat.id"
          :has-image="flat.hasImage"
          :alt="flat.title"
          class="w-28 shrink-0 self-stretch rounded-none object-cover object-center"
          :width="112"
          :height="112"
        />
        <div class="flex min-w-0 flex-col justify-center py-3 pr-10">
          <MapFlatPreviewContent :flat="flat" />
        </div>
      </a>
    </div>
  </Transition>
</template>
