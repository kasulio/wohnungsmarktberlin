<script setup lang="ts">
import lottie from "lottie-web";

if (import.meta.client) {
  // No top-level await — layout must not suspend on icon boot.
  void (async () => {
    const { Element, defineElement } = await import("@lordicon/element");

    const icons: Record<string, unknown> = {};
    const inflight = new Map<string, Promise<unknown>>();

    function loadIcon(name: string) {
      if (icons[name]) return Promise.resolve(icons[name]);
      const existing = inflight.get(name);
      if (existing) return existing;

      const promise = fetch(`/icons/${name}.json`)
        .then((response) => response.json())
        .then((data) => {
          icons[name] = data;
          return data;
        })
        .finally(() => inflight.delete(name));

      inflight.set(name, promise);
      return promise;
    }

    Element.setIconLoader((name: string) => loadIcon(name));
    defineElement(lottie.loadAnimation);

    void Promise.allSettled(
      ["heart", "arrow", "notification-bell", "trash", "cross"].map(loadIcon),
    );
  })();
}
</script>
<template>
  <div></div>
</template>
