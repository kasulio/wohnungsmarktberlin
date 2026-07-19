<script setup lang="ts">
const { $client } = useNuxtApp();
const [propertyManagementsWithFlats, mapPreviewHash] = await Promise.all([
  $client.flat.getFeatured.query({
    limit: 10,
  }),
  $client.flat.getMapPreviewHash.query(),
]);

const flats = propertyManagementsWithFlats;
const config = useRuntimeConfig();

const pageDescription =
  "Finde aktuelle Mietwohnungen in Berlin – von Berlinovo, Degewo, Deutsche Wohnen, Gewobag, HOWOGE, Stadt und Land und Vonovia. Täglich aktualisiert, kostenlos, ohne Anmeldung.";
const pageTitle = "Berlins Wohnungsmarkt auf einen Blick";

useSeoMeta({
  title: pageTitle,
  description: pageDescription,
  ogTitle: `WohnungsMarktBerlin – ${pageTitle}`,
  ogDescription: pageDescription,
  ogUrl: config.public.deploymentUrl,
  twitterTitle: `WohnungsMarktBerlin – ${pageTitle}`,
  twitterDescription: pageDescription,
});

useHead({
  script: [
    {
      type: "application/ld+json",
      innerHTML: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "WohnungsMarktBerlin",
        url: config.public.deploymentUrl,
        description: pageDescription,
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${config.public.deploymentUrl}/overview`,
          },
          "query-input": "required name=search_term_string",
        },
      }),
    },
    {
      type: "application/ld+json",
      innerHTML: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "WohnungsMarktBerlin",
        url: config.public.deploymentUrl,
        email: "wohnungsmarkt@lukasfrey.com",
        description:
          "Aggregator für Berliner Mietwohnungen öffentlicher Hausverwaltungen.",
      }),
    },
  ],
});
</script>

<template>
  <div class="layout flex flex-col gap-y-4">
    <div
      class="eyecatcher relative ml-[56px] flex rounded-3xl bg-main p-5 md:ml-0"
    >
      <h1
        class="eyecatcher__headline my-auto ml-[-76px] mr-16 hyphens-manual text-[3rem] font-bold leading-[3rem] text-white [-webkit-text-stroke-color:#000] [-webkit-text-stroke-width:0.75px] [text-shadow:4px_4px_0px_#a555a2] xs:text-[3.75rem] xs:leading-[3.5rem] sm:text-[4.5rem] sm:leading-[4.5rem] md:hyphens-auto md:text-[6rem] md:leading-[5.5rem] md:[-webkit-text-stroke-width:1px] md:[text-shadow:6px_6px_0px_#a555a2]"
      >
        Berlins Wohnungs&shy;markt auf einen&nbsp;Blick
      </h1>
      <NuxtLink
        to="#section_about"
        title='Gehe zu "Über dieses Projekt"'
      >
        <img
          src="../assets/questionmark.svg"
          alt=""
          class="eyecatcher__explanation absolute right-3 top-3"
        />
      </NuxtLink>
    </div>
    <div
      class="apartmentlist relative flex flex-col gap-4 rounded-3xl border border-black bg-background p-5 pb-16"
    >
      <ApartmentPreview
        v-for="flat in flats"
        :id="flat.id"
        :key="flat.id"
        :title="flat.title"
        :address="flat.address!"
        :cold-rent-price="flat.coldRentPrice"
        :warm-rent-price="flat.warmRentPrice"
        :tags="flat.tags"
        :usable-area="flat.usableArea"
        :has-image="flat.hasImage"
        :url="flat.url"
        :first-seen="new Date(flat.firstSeen)"
        :property-management-id="flat.propertyManagementId"
      />

      <FatButton
        class="absolute -bottom-5 -right-4 md:-right-10"
        href="/overview"
      >
        Alle Wohnungen ansehen
        <img
          src="/arrow_right.svg"
          width="32"
          height="23"
          aria-hidden="true"
          class="ml-4 inline"
        />
      </FatButton>
    </div>
    <NuxtLink
      to="/map"
      class="map_preview relative mt-8 aspect-square overflow-hidden rounded-3xl border border-black md:mt-0"
      title="Zur Karte"
    >
      <NuxtImg
        :src="`${config.public.deploymentUrl}/api/image/map-preview/${mapPreviewHash}`"
        alt="Vorschau der Karte"
        class="h-full w-full object-cover"
        :width="512"
        :height="512"
        format="avif,webp"
      />
      <IconZoomIn class="absolute right-4 top-4" />
    </NuxtLink>

    <div
      class="decoration relative hidden min-h-32 overflow-hidden rounded-3xl border border-black md:block"
    >
      <ImageSlider
        :images="[
          'simone-hutsch-YsEOuVd7afg-unsplash.jpg',
          'wasimul-hossain-XoIXsOnTOM0-unsplash.jpg',
        ]"
      />
    </div>
    <div
      id="section_about"
      class="about rounded-3xl border border-black p-5"
    >
      <h2
        class="inline-block rounded-md bg-primary px-2 py-1 text-xl font-semibold leading-10 text-white"
      >
        Über dieses Projekt
      </h2>
      <section>
        <h3
          class="mb-2 mt-4 inline-block rounded-md bg-accent px-2 text-l text-white"
        >
          Was?
        </h3>

        <p>
          Wir
          <NuxtLink
            to="https://de.wikipedia.org/wiki/Screen_Scraping"
            target="_blank"
            class="cursor-help underline"
          >
            <!--  eslint-disable-next-line vue/multiline-html-element-content-newline -->
            scrapen</NuxtLink
          >
          die Webseiten verschiedener Berliner Wohnungsverwaltungen und stellen
          die Wohnungen für alle zugänglich bereit.
        </p>
      </section>
      <section>
        <h3
          class="mb-2 mt-4 inline-block rounded-md bg-accent px-2 text-l text-white"
        >
          Warum?
        </h3>
        <p>Versuch mal in Berlin eine bezahlbare Wohnung zu finden...</p>

        <p>
          Es gibt nur wenige und die sind häufig auf den Websites der einzelnen
          Hausverwaltungen versteckt.
        </p>
        <p>
          Um nicht jede Website einzeln durchsuchen zu müssen, haben wir hier
          alle zusammengetragen :)
        </p>
      </section>
      <section>
        <h3
          class="mb-2 mt-4 inline-block rounded-md bg-accent px-2 text-l text-white"
        >
          Wer?
        </h3>
        <p>
          <NuxtLink
            to="mailto:wohnungsmarkt@lukasfrey.com"
            class="underline"
          >
            <!-- eslint-disable-next-line vue/multiline-html-element-content-newline -->
            Lukas Frey</NuxtLink
          >
          &
          <NuxtLink
            to="mailto:malie.bertram@student.htw-berlin.de"
            class="underline"
          >
            <!-- eslint-disable-next-line vue/multiline-html-element-content-newline -->
            Malie Bertram</NuxtLink
          >
        </p>
        <p>
          Entstanden ist das Projekt im Rahmen des Moduls "Webtechnologien" an
          der
          <a
            href="https://www.htw-berlin.de/"
            class="underline"
            >HTW Berlin</a
          >. Wir sind so zufrieden mit unserem Ergebnis, dass wir es live
          stellen wollten.
        </p>
      </section>
    </div>
  </div>
</template>
<style scoped>
@media screen and (min-width: 768px) {
  .layout {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    grid-template-rows: auto auto auto auto auto auto;
    column-gap: 1.25rem;
    grid-auto-flow: row;
    grid-template-areas:
      "eyecatcher eyecatcher map_preview"
      "eyecatcher eyecatcher decoration"
      "apartmentlist apartmentlist apartmentlist"
      ". . ."
      ". . ."
      "about about about";
  }
}
@media screen and (min-width: 1024px) {
  .layout {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr;
    gap: 1.25rem;
    grid-auto-flow: row;
    grid-template-areas:
      "eyecatcher eyecatcher eyecatcher eyecatcher eyecatcher eyecatcher apartmentlist apartmentlist apartmentlist apartmentlist apartmentlist apartmentlist"
      "eyecatcher eyecatcher eyecatcher eyecatcher eyecatcher eyecatcher apartmentlist apartmentlist apartmentlist apartmentlist apartmentlist apartmentlist"
      "map_preview map_preview map_preview map_preview map_preview map_preview apartmentlist apartmentlist apartmentlist apartmentlist apartmentlist apartmentlist"
      "map_preview map_preview map_preview map_preview map_preview map_preview apartmentlist apartmentlist apartmentlist apartmentlist apartmentlist apartmentlist"
      ". . . . . . . . . . . ."
      "about about about about about about about about decoration decoration decoration decoration"
      "about about about about about about about about decoration decoration decoration decoration";
  }
}

.eyecatcher {
  grid-area: eyecatcher;
}

.apartmentlist {
  grid-area: apartmentlist;
}

.map_preview {
  grid-area: map_preview;
}

.decoration {
  grid-area: decoration;
}

.mailing_list {
  grid-area: mailing_list;
}

.about {
  grid-area: about;
}
</style>
