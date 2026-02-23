<script setup lang="ts">
const requestUrl = useRequestURL();
const currentUrl = requestUrl.origin;
const canonicalUrl = computed(() => requestUrl.origin + requestUrl.pathname);

const siteTitle = "WohnungsMarktBerlin";
const defaultTitle = "Berlins Wohnungsmarkt auf einen Blick";
const defaultDescription =
  "Alle Berliner Mietwohnungen öffentlicher Hausverwaltungen auf einen Blick – aktuell, kostenlos und täglich aktualisiert.";

useHead({
  titleTemplate: (title) =>
    title && title !== defaultTitle
      ? `${title} | ${siteTitle}`
      : `${siteTitle} – ${defaultTitle}`,
  title: defaultTitle,
  link: [{ rel: "canonical", href: canonicalUrl }],
  meta: [
    {
      name: "description",
      content: defaultDescription,
    },
    { property: "og:site_name", content: siteTitle },
    { property: "og:type", content: "website" },
    {
      property: "og:title",
      content: `${siteTitle} – ${defaultTitle}`,
    },
    {
      property: "og:description",
      content: defaultDescription,
    },
    {
      property: "og:image",
      content: `${currentUrl}/og-image.png`,
    },
    {
      property: "og:url",
      content: canonicalUrl,
    },
    {
      property: "twitter:title",
      content: `${siteTitle} – ${defaultTitle}`,
    },
    {
      property: "twitter:description",
      content: defaultDescription,
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
