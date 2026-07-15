<script setup lang="ts">
const props = defineProps<{
  totalElementsCount: number;
  filteredElementsCount: number;
  currentPage: number;
  pageSize: number;
}>();

const { updateQueryState, urlState } = usePaginationUrlState();

const maxPage = computed(() => {
  return Math.ceil(props.filteredElementsCount / props.pageSize);
});

const pageSizeOptions = [25, 50, 100] as const;
const defaultPageSize = pageSizeOptions[0];

const updatePagination = (page: number, pageSize: number, replace = true) => {
  const pageSizeToGoTo = pageSizeOptions.includes(pageSize)
    ? pageSize
    : defaultPageSize;

  // automatically fix page, when it is out of bounds
  const pageToGoTo = Math.min(
    Math.max(1, page),
    Math.ceil(props.filteredElementsCount / pageSizeToGoTo),
  );

  updateQueryState(
    {
      page: [pageToGoTo],
      pageSize: [pageSizeToGoTo],
    },
    // decide whether to replace or push state
    replace || page !== pageToGoTo || pageSize !== pageSizeToGoTo,
  );
};

if (props.currentPage > maxPage.value && maxPage.value > 0) {
  updatePagination(maxPage.value, props.pageSize);
}

onMounted(() => {
  if (urlState.value.page || urlState.value.pageSize) {
    updatePagination(props.currentPage, props.pageSize, true);
  }
});

const navBtn =
  "size-8 items-center justify-center rounded-md text-main/55 transition-colors hover:bg-white hover:text-main disabled:pointer-events-none disabled:opacity-35";
</script>

<template>
  <div class="rounded-xl border border-black bg-background px-2.5 py-2.5">
    <div class="flex items-center justify-between gap-2">
      <div class="flex items-center gap-1.5">
        <label
          class="shrink-0 text-xs font-medium text-main/50"
          for="page-size"
          >Pro Seite</label
        >
        <select
          id="page-size"
          class="h-8 appearance-none rounded-md bg-white px-2.5 text-s font-medium text-main focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
          :value="pageSize"
          @change="
            ($event: Event) => {
              const target = $event.target as HTMLSelectElement;
              updatePagination(currentPage, Number(target.value));
            }
          "
        >
          <option
            v-for="ps in pageSizeOptions"
            :key="ps"
            :value="ps"
            :selected="ps === props.pageSize"
          >
            {{ ps }}
          </option>
        </select>
      </div>

      <div class="flex items-center gap-0.5">
        <button
          type="button"
          :disabled="currentPage === 1"
          :class="[navBtn, 'hidden md:inline-flex']"
          aria-label="Erste Seite"
          @click="updatePagination(1, pageSize)"
        >
          <Icon
            name="lucide:chevrons-left"
            class="size-3.5"
          />
        </button>
        <button
          type="button"
          :disabled="currentPage === 1"
          :class="[navBtn, 'inline-flex']"
          aria-label="Vorherige Seite"
          @click="updatePagination(currentPage - 1, pageSize)"
        >
          <Icon
            name="lucide:chevron-left"
            class="size-3.5"
          />
        </button>
        <span
          class="min-w-[4.5rem] px-1.5 text-center text-s tabular-nums text-main/55"
        >
          <span class="sr-only">Seite </span>{{ currentPage }}
          <span aria-hidden="true"> / </span>
          <span class="sr-only"> von </span>{{ maxPage }}
        </span>
        <button
          type="button"
          :disabled="currentPage === maxPage"
          :class="[navBtn, 'inline-flex']"
          aria-label="Nächste Seite"
          @click="updatePagination(currentPage + 1, pageSize)"
        >
          <Icon
            name="lucide:chevron-right"
            class="size-3.5"
          />
        </button>
        <button
          type="button"
          :disabled="currentPage === maxPage"
          :class="[navBtn, 'hidden md:inline-flex']"
          aria-label="Letzte Seite"
          @click="updatePagination(maxPage, pageSize)"
        >
          <Icon
            name="lucide:chevrons-right"
            class="size-3.5"
          />
        </button>
      </div>
    </div>
  </div>
</template>
