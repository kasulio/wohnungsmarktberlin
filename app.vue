<script setup lang="ts">
const currentUrl = useRequestURL().origin;
useHead({
  title: "Berlins Wohnungsmarkt auf einen Blick",
  meta: [
    {
      name: "description",
      content:
        "WohnungsMarktBerlin - Berlins Wohnungsmarkt auf einen Blick. Finde die passende Hausverwaltung für deine Wohnung.",
    },
    {
      property: "og:title",
      content: "WohnungsMarktBerlin - Berlins Wohnungsmarkt auf einen Blick",
    },
    {
      property: "og:description",
      content:
        "WohnungsMarktBerlin - Berlins Wohnungsmarkt auf einen Blick. Finde die passende Hausverwaltung für deine Wohnung.",
    },
    {
      property: "og:image",
      content: `${currentUrl}/og-image.png`,
    },
    {
      property: "og:url",
      content: currentUrl,
    },
    {
      property: "twitter:title",
      content: "WohnungsMarktBerlin - Berlins Wohnungsmarkt auf einen Blick",
    },
    {
      property: "twitter:description",
      content:
        "WohnungsMarktBerlin - Berlins Wohnungsmarkt auf einen Blick. Finde die passende Hausverwaltung für deine Wohnung.",
    },
    {
      property: "twitter:image",
      content: `${currentUrl}/og-image.png`,
    },
    {
      property: "twitter:card",
      content: "summary_large_image",
    },
  ],
  bodyAttrs: {
    class: "antialiased min-h-dvh h-1",
  },
});

const loadingIndicator = useCustomLoadingIndicator();
const nuxtApp = useNuxtApp();
const _cleanup: Array<() => void> = [];
const pageLoading = ref(false);
onMounted(() => {
  _cleanup.push(
    nuxtApp.hook("page:loading:start", () => {
      pageLoading.value = true;
    }),
  );

  _cleanup.push(
    nuxtApp.hook("page:loading:end", () => {
      pageLoading.value = false;
    }),
  );

  _cleanup.push(
    nuxtApp.hook("vue:error", () => {
      pageLoading.value = false;
    }),
  );

  _cleanup.push(
    loadingIndicator.registerLoadingRef(pageLoading, (l) => l.value),
  );
});
onUnmounted(() => _cleanup.forEach((hook) => hook()));
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
