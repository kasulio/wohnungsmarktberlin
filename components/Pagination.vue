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
</script>

<template>
  <div class="flex items-center justify-between gap-2">
    <div class="flex gap-2 md:gap-4">
      <label class="">Einträge pro Seite</label>
      <select
        class="rounded-md bg-white text-center shadow-inner [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
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
    <div class="flex flex-grow justify-end">
      <div class="flex items-center gap-2">
        <button
          :disabled="currentPage === 1"
          class="hidden rounded-full bg-background p-2 leading-4 text-accent transition-colors duration-200 hover:bg-accent hover:text-white disabled:opacity-50 md:block"
          @click="updatePagination(1, pageSize)"
        >
          &lt;&lt;
        </button>
        <button
          :disabled="currentPage === 1"
          class="rounded-full bg-background p-2 leading-4 text-accent transition-colors duration-200 hover:bg-accent hover:text-white disabled:opacity-50"
          @click="updatePagination(currentPage - 1, pageSize)"
        >
          &lt;
        </button>
        <span>
          <span class="hidden md:inline-block">Seite&nbsp;</span
          >{{ currentPage }}&nbsp;von&nbsp;{{ maxPage }}
        </span>
        <button
          :disabled="currentPage === maxPage"
          class="rounded-full bg-background p-2 leading-4 text-accent transition-colors duration-200 hover:bg-accent hover:text-white disabled:opacity-50"
          @click="updatePagination(currentPage + 1, pageSize)"
        >
          &gt;
        </button>
        <button
          :disabled="currentPage === maxPage"
          class="hidden rounded-full bg-background p-2 leading-4 text-accent transition-colors duration-200 hover:bg-accent hover:text-white disabled:opacity-50 md:block"
          @click="updatePagination(maxPage, pageSize)"
        >
          &gt;&gt;
        </button>
      </div>
    </div>
  </div>
</template>
