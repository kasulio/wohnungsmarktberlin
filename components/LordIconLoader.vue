<script setup lang="ts">
import lottie from "lottie-web";
if (import.meta.client) {
  const { Element, defineElement } = await import("@lordicon/element");
  async function fetchIcon(name: string) {
    const response = await fetch(`/icons/${name}.json`);
    const data = await response.json();
    return data;
  }

  const icons = ref<Record<string, any>>({});

  await Promise.allSettled(
    ["heart", "arrow"].map(async (icon) => {
      icons.value[icon] = await fetchIcon(icon);
    }),
  );

  Element.setIconLoader(async (name: string) => {
    if (icons.value[name]) {
      return icons.value[name];
    }
    return await fetchIcon(name);
  });

  defineElement(lottie.loadAnimation);
}
</script>
<template>
  <div></div>
</template>
