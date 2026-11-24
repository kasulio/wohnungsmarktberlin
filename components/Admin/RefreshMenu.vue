<script setup lang="ts">
export type AdminScrapeMode = "full" | "sync_only" | "extract_only";

const props = withDefaults(
  defineProps<{
    label?: string;
    disabled?: boolean;
    loadingMode?: AdminScrapeMode | null;
    prominent?: boolean;
  }>(),
  { label: "Aktualisieren", loadingMode: null },
);

const emit = defineEmits<{ run: [mode: AdminScrapeMode] }>();

const open = ref(false);
const root = ref<HTMLElement | null>(null);

const run = (mode: AdminScrapeMode) => {
  open.value = false;
  emit("run", mode);
};

const closeOnOutsideClick = (e: MouseEvent) => {
  if (root.value && !root.value.contains(e.target as Node)) open.value = false;
};
onMounted(() => document.addEventListener("click", closeOnOutsideClick));
onBeforeUnmount(() =>
  document.removeEventListener("click", closeOnOutsideClick),
);

const buttonClass = computed(() =>
  props.prominent
    ? "border-primary bg-primary text-white hover:bg-primary/90"
    : "border-black/70 bg-white text-main hover:bg-black/[0.03]",
);
</script>

<template>
  <div
    ref="root"
    class="relative inline-flex"
    :class="prominent ? 'rounded-xl shadow-accent' : ''"
  >
    <button
      type="button"
      class="inline-flex items-center gap-2 rounded-l-xl border font-medium disabled:cursor-not-allowed disabled:opacity-60"
      :class="[
        buttonClass,
        prominent ? 'px-4 py-2.5 text-s' : 'px-3 py-1.5 text-xs',
      ]"
      :disabled="disabled"
      title="Sync + Extraktion"
      @click="run('full')"
    >
      {{ label }}
      <LoadingSpinner
        v-if="loadingMode === 'full'"
        class="!h-4 !w-4"
      />
    </button>
    <button
      type="button"
      class="inline-flex items-center rounded-r-xl border border-l-0 font-medium disabled:cursor-not-allowed disabled:opacity-60"
      :class="[buttonClass, prominent ? 'px-2.5 text-s' : 'px-2 text-xs']"
      :disabled="disabled"
      aria-haspopup="menu"
      :aria-expanded="open"
      aria-label="Weitere Aktionen"
      @click="open = !open"
    >
      <LoadingSpinner
        v-if="loadingMode === 'sync_only' || loadingMode === 'extract_only'"
        class="!h-4 !w-4"
      />
      <span
        v-else
        aria-hidden="true"
        >▾</span
      >
    </button>
    <div
      v-if="open"
      role="menu"
      class="absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-xl border border-black bg-white text-xs text-main shadow-lg"
    >
      <button
        type="button"
        role="menuitem"
        class="block w-full px-3 py-2 text-left hover:bg-secondary"
        @click="run('sync_only')"
      >
        Nur Sync
        <span class="block text-gray-500">Listen abgleichen</span>
      </button>
      <button
        type="button"
        role="menuitem"
        class="block w-full border-t border-black/10 px-3 py-2 text-left hover:bg-secondary"
        @click="run('extract_only')"
      >
        Nur Extraktion
        <span class="block text-gray-500">Offene Inserate abrufen</span>
      </button>
    </div>
  </div>
</template>
