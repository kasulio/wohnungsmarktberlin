<script setup lang="ts">
import lottie from "lottie-web";
import { Element, defineElement } from "@lordicon/element";

async function fetchIcon(name: string) {
  const response = await fetch(`/icons/${name}.json`);
  return await response.json();
}

const icons: Record<string, unknown> = {};

Element.setIconLoader(async (name: string) => {
  if (icons[name]) return icons[name];
  const data = await fetchIcon(name);
  icons[name] = data;
  return data;
});

defineElement(lottie.loadAnimation);

void Promise.allSettled(
  ["heart", "arrow", "notification-bell", "trash", "cross"].map(
    async (name) => {
      icons[name] = await fetchIcon(name);
    },
  ),
);
</script>
<template>
  <div></div>
</template>
