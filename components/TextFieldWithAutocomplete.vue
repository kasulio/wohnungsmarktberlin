<template>
  <div class="w-full">
    <div
      class="relative my-2 w-full rounded-md bg-white p-1 shadow-[inset_0_1px_4px_rgba(0,0,0,0.4)]"
    >
      <div class="flex w-full gap-1 overflow-x-auto">
        <input
          v-model="inputValue"
          type="text"
          class="mt-0 h-full w-32 grow rounded-md px-1 outline-none"
          placeholder="hinzufügen..."
          @input="handleInput"
          @keydown.down="highlightNext"
          @keydown.up="highlightPrev"
          @keydown.enter.prevent="selectHighlighted"
          @focus="handleFocus"
          @blur="handleBlur"
        />
        <div
          v-for="key in props.modelValue"
          :key="key"
          title="Tag entfernen"
          class="bubble flex h-5 w-full min-w-fit max-w-fit cursor-pointer flex-row items-center justify-end rounded-[0.2rem] bg-gray-300 px-2 py-3 text-s"
          @click="removeItem(key)"
        >
          <span class="whitespace-nowrap">{{
            props.suggestions.find((item) => item.id === key)?.title
          }}</span>
          <img
            src="/cancel_remove.svg"
            alt="entfernen"
            class="ml-1 w-4"
          />
        </div>
      </div>
      <div
        v-if="showSuggestions"
        class="absolute left-0 top-full z-10 mt-1 max-h-60 w-full overflow-x-hidden overflow-y-scroll rounded-md bg-white drop-shadow-md"
      >
        <div
          v-for="(suggestion, index) in filteredSuggestions"
          :key="index"
          :class="{ 'bg-gray-300': index === highlightedIndex }"
          class="px-2 py-1 first:pt-1 last:pb-1 hover:bg-gray-300"
          @mousedown.prevent="selectSuggestion(suggestion.id)"
        >
          {{ suggestion.title }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
type Suggestion = { id: string; title: string };

const props = defineProps<{
  suggestions: Suggestion[];
  modelValue: string[];
}>();

const $emit = defineEmits(["update:modelValue"]);

const inputValue = ref("");
const highlightedIndex = ref(-1);
const showSuggestions = ref(false);

const handleInput = (event: Event) => {
  inputValue.value = (event.target as HTMLInputElement).value;
  highlightedIndex.value = -1;
};

const handleFocus = () => {
  showSuggestions.value = true;
  highlightedIndex.value = -1;
};

const handleBlur = () => {
  showSuggestions.value = false;
};

const filteredSuggestions = computed(() => {
  return props.suggestions.filter(
    (suggestion: Suggestion) =>
      suggestion.title.toLowerCase().includes(inputValue.value.toLowerCase()) &&
      !props.modelValue.includes(suggestion.id),
  );
});

const highlightNext = (event: { preventDefault: () => void }) => {
  event.preventDefault();
  if (highlightedIndex.value === filteredSuggestions.value.length - 1) {
    highlightedIndex.value = -1;
  } else {
    highlightedIndex.value++;
  }
};

const highlightPrev = (event: { preventDefault: () => void }) => {
  event.preventDefault();
  if (highlightedIndex.value <= 0) {
    highlightedIndex.value = filteredSuggestions.value.length - 1;
  } else {
    highlightedIndex.value--;
  }
};

const selectHighlighted = () => {
  const suggestion = filteredSuggestions.value[highlightedIndex.value];
  if (suggestion) {
    selectSuggestion(suggestion.id);
  }
};

const selectSuggestion = (id: Suggestion["id"]) => {
  $emit("update:modelValue", [...new Set([...props.modelValue, id])]);

  inputValue.value = "";
  highlightedIndex.value = -1;
};

const removeItem = (id: string) => {
  console.log("removing", props.modelValue, id);
  $emit("update:modelValue", [
    ...props.modelValue.filter((value) => value !== id),
  ]);
};
</script>
